import React from "react";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { Primitive } from "@radix-ui/react-primitive";

const blink = keyframes`
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
`;

const Flex = styled(Primitive.div)`
  display: flex;
  align-items: center;
`;

const Dot = styled(Primitive.div)`
  width: 8px;
  height: 8px;
  margin: 0 4px;
  background-color: #fe5000;
  border-radius: 50%;
  animation: ${blink} 1s infinite;
`;

const TypingIndicator: React.FC = () => (
  <Flex>
    {[0, 0.2, 0.4].map((delay, index) => (
      <Dot key={index} style={{ animationDelay: `${delay}s` }} />
    ))}
  </Flex>
);

export default TypingIndicator;
