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
  name: "create_deal_task",
  title: "Create deal task",
  description: "Create a task attached to a CRM deal for the signed-in user.",
  inputSchema: {
    deal_id: z.string().uuid().describe("The deal (funnel_deal) id to attach the task to."),
    title: z.string().trim().min(1).describe("Short title for the task."),
    description: z.string().trim().optional().describe("Optional details."),
    due_date: z.string().optional().describe("Optional YYYY-MM-DD due date."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ deal_id, title, description, due_date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("deal_tasks")
      .insert({
        user_id: ctx.getUserId(),
        deal_id,
        title,
        description: description ?? null,
        due_date: due_date ?? null,
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
