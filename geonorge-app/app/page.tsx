"use client";

import ChatUI from "./components/ChatUI";
import DemoV2 from "./components/Demo";
/* import Demo from "./components/Demo";
 */
export default function Home() {
  return (
    <div className="relative h-screen w-full">
      <DemoV2 />
      {/* <ChatUI webSocketUrl="ws://localhost:8080" /> */}
    </div>
  );
}
