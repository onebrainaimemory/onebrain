# onebrain-mcp

MCP (Model Context Protocol) server for [OneBrain](https://onebrain.rocks) — persistent AI memory for Claude, Cursor, Windsurf, and any MCP-compatible tool.

## Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "onebrain": {
      "command": "npx",
      "args": ["-y", "onebrain-mcp"],
      "env": {
        "ONEBRAIN_API_URL": "https://onebrain.rocks/api/eu",
        "ONEBRAIN_API_KEY": "ob_your_key_here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "onebrain": {
      "command": "npx",
      "args": ["-y", "onebrain-mcp"],
      "env": {
        "ONEBRAIN_API_URL": "https://onebrain.rocks/api/eu",
        "ONEBRAIN_API_KEY": "ob_your_key_here"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "onebrain": {
      "command": "npx",
      "args": ["-y", "onebrain-mcp"],
      "env": {
        "ONEBRAIN_API_URL": "https://onebrain.rocks/api/eu",
        "ONEBRAIN_API_KEY": "ob_your_key_here"
      }
    }
  }
}
```

## Environment Variables

| Variable           | Required | Default                 | Description                                                            |
| ------------------ | -------- | ----------------------- | ---------------------------------------------------------------------- |
| `ONEBRAIN_API_KEY` | Yes      | —                       | Your OneBrain API key (create at dashboard > API Keys)                 |
| `ONEBRAIN_API_URL` | No       | `http://localhost:3001` | API base URL. Use `https://onebrain.rocks/api/eu` for hosted EU region |

## Available Tools

| Tool                  | Description                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| `get_user_context`    | Get full brain context: profile, memories, entities, projects, stats      |
| `search_memory`       | Search and filter memories by type and status                             |
| `write_memory`        | Create a new memory (fact, preference, decision, goal, experience, skill) |
| `write_memory_batch`  | Create multiple memories at once (1-10, dedup included)                   |
| `upsert_entity`       | Create or update an entity (person, place, org, etc.)                     |
| `get_project_context` | Get project details or list active projects                               |

## Self-Hosted

For self-hosted OneBrain instances, set `ONEBRAIN_API_URL` to your API endpoint (e.g. `http://localhost:3001`).

## Requirements

- Node.js >= 20
- An OneBrain account with an API key

## License

MIT
