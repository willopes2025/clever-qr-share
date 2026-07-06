import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listContactsTool from "./tools/list-contacts";
import listDealsTool from "./tools/list-deals";
import createTaskTool from "./tools/create-task";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "wideic-zap-mcp",
  title: "Wideic Zap MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Wideic CRM: list contacts, list CRM deals, and create tasks for the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listContactsTool, listDealsTool, createTaskTool],
});
