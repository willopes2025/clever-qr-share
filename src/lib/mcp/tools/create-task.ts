import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_task",
  title: "Create task",
  description: "Create a task assigned to the signed-in user.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Short title for the task."),
    description: z.string().trim().optional().describe("Optional details."),
    due_date: z.string().datetime().optional().describe("Optional ISO 8601 due date."),
    contact_id: z.string().uuid().optional().describe("Optional related contact id."),
    deal_id: z.string().uuid().optional().describe("Optional related deal id."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, description, due_date, contact_id, deal_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: ctx.getUserId(),
        title,
        description: description ?? null,
        due_date: due_date ?? null,
        contact_id: contact_id ?? null,
        deal_id: deal_id ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Task created: ${data.id}` }],
      structuredContent: { task: data },
    };
  },
});
