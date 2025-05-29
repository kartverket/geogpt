"""
Custom tool execution utilities for LangGraph.

These custom implementations replace the deprecated ToolExecutor and ToolInvocation
from langgraph.prebuilt.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ToolInvocation(BaseModel):
    """Tool invocation request model.
    
    This class represents a request to invoke a tool with specific input.
    """
    tool: str = Field(..., description="The name of the tool to invoke")
    tool_input: Dict[str, Any] = Field(default_factory=dict, description="The input to the tool")
    id: Optional[str] = Field(default=None, description="The ID of the tool invocation")


class ToolExecutor:
    """A class that executes tools.
    
    This class is responsible for executing tools based on their name and input.
    """
    
    def __init__(self, tools: List[Any]):
        """Initialize with a list of tools.
        
        Args:
            tools: A list of tool objects to execute.
        """
        self.tools = {tool.name: tool for tool in tools}
    
    async def ainvoke(self, tool_invocation: ToolInvocation) -> Any:
        """Invoke a tool asynchronously.
        
        Args:
            tool_invocation: The tool invocation request.
            
        Returns:
            The result of the tool execution.
            
        Raises:
            ValueError: If the tool name is not found.
        """
        tool_name = tool_invocation.tool
        tool_input = tool_invocation.tool_input
        
        if tool_name not in self.tools:
            raise ValueError(f"Tool {tool_name} not found. Available tools: {list(self.tools.keys())}")
            
        # Get the tool
        tool = self.tools[tool_name]
        
        # If the tool has an async invoke method, use it
        if hasattr(tool, "ainvoke"):
            return await tool.ainvoke(**tool_input)
        elif hasattr(tool, "func"):
            # If it's a structured tool, call the function
            func = tool.func
            
            # Check if the function is async
            import inspect
            if inspect.iscoroutinefunction(func):
                return await func(**tool_input)
            else:
                # Run synchronous function in a thread pool
                import asyncio
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, lambda: func(**tool_input))
        else:
            # Fallback to standard __call__
            return tool(**tool_input)
    
    def invoke(self, tool_invocation: ToolInvocation) -> Any:
        """Invoke a tool synchronously.
        
        Args:
            tool_invocation: The tool invocation request.
            
        Returns:
            The result of the tool execution.
            
        Raises:
            ValueError: If the tool name is not found.
        """
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            # Create a new event loop if we're not in an async context
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        return loop.run_until_complete(self.ainvoke(tool_invocation)) 