"use client";

import { useEffect } from "react";
import type { PaddleSdk } from "./PaddleSandboxReadiness";

type PaddleCheckout = PaddleSdk;

let loading: Promise<PaddleCheckout> | undefined;
let initialized = false;

export async function ensurePaddleLive(): Promise<PaddleCheckout> {
 const token = process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN;
 if (!token?.startsWith("live_"))
   throw Error("Paddle Live client token is unavailable.");
 if (!loading) loading = new Promise<PaddleCheckout>((resolve, reject) => {
   if (window.Paddle) { resolve(window.Paddle); return; }
   const script = document.createElement("script");
   script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
   script.async = true;
   script.onload = () => window.Paddle ? resolve(window.Paddle) : reject(Error("Paddle did not load."));
   script.onerror = () => { loading = undefined; reject(Error("Paddle could not load.")); };
   document.head.appendChild(script);
 });
 const paddle = await loading;
 if (!initialized) {
   paddle.Initialize({
     token,
     eventCallback: (event) => {
       // A browser event is only UI feedback. Pro is granted after server
       // webhook receipt and Paddle API payment evidence verification.
       if (event.name === "checkout.completed")
         window.location.assign("/pro/paddle-pending");
     },
   });
   initialized = true;
 }
 return paddle;
}

/** The default Paddle payment link /pricing?_ptxn=... needs Paddle.js. */
export function PaddleLivePaymentLinkBootstrap() {
 useEffect(() => {
   if (process.env.NEXT_PUBLIC_PADDLE_LIVE_CHECKOUT_ENABLED === "enabled") {
     void ensurePaddleLive().catch(() => {
       // Failed loading should not silently open checkout or change plan.
     });
   }
 }, []);
 return null;
}
