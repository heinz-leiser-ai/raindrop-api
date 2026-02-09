---
description: Connect AI models and agents to Raindrop.io data through the Model Context Protocol (MCP)
---

# MCP Server

The Raindrop.io [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server provides a standardized interface for AI models and agents to read and manage your bookmark data.

{% hint style="warning" %}
MCP is currently in **beta** and available to [Pro](https://raindrop.io/pro/buy) users.
{% endhint %}

## Endpoint

```
https://api.raindrop.io/rest/v2/ai/mcp
```

Transport: **Streamable HTTP** (the only supported transport).

## Authentication

### OAuth 2.1 (Interactive)

The MCP server supports OAuth 2.1 authentication. When connecting through a compatible MCP client (Claude, ChatGPT, Cursor, etc.), your browser will open automatically to authorize access to your Raindrop.io account.

### Bearer Token

You can also use the same access token as with the [REST API](../v1/authentication/README.md). Pass it in the `Authorization: Bearer <your-token>` header. See [Authentication](../v1/authentication/README.md) for details on obtaining a token.

## Client Configuration

For step-by-step setup instructions for Claude, ChatGPT, VS Code, Cursor, and other clients, see the [Raindrop.io Help Center](https://help.raindrop.io/mcp).
