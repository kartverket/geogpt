"use client";

import ChatUI from "./components/ChatUI";
/* import Demo from "./components/Demo";
 */
export default function Home() {
  return (
    <div className="relative h-screen w-full">
{/*       <Demo />
 */}      <ChatUI webSocketUrl="ws://localhost:8080" />
    </div>
  );
}
