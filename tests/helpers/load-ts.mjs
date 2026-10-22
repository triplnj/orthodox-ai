import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const requireDependency = createRequire(import.meta.url);

// Compile the real application modules in memory. Replace only the supplied
// infrastructure boundaries; no database, Next server, or emitted files needed.
export function createLoader(mocks = {}, env = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const cache = new Map();
  const environment = { ...process.env, ...env };
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = fs.readFileSync(filename, "utf8");
    const result = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    function localRequire(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/")
          ? path.join(root, "src", specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        const resolved = [target, `${target}.ts`, `${target}.tsx`]
          .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!resolved) throw new Error(`Cannot resolve ${specifier} from ${filename}`);
        return load(resolved);
      }
      return requireDependency(specifier);
    }
    const wrapper = vm.runInThisContext(
      `(function(exports, require, module, __filename, __dirname, process) {${result.outputText}\n})`,
      { filename },
    );
    wrapper(loadedModule.exports, localRequire, loadedModule, filename, path.dirname(filename), {
      env: environment,
    });
    return loadedModule.exports;
  }
  load.environment = environment;
  return load;
}

