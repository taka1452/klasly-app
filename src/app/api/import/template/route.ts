const TEMPLATE_CSV = `Name,Email,Phone,Plan Type,Credits,Status,Notes
Jane Doe,jane@example.com,555-123-4567,drop_in,0,active,Prefers morning classes`;

export async function GET() {
  return new Response(TEMPLATE_CSV, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="klasly-member-import-template.csv"',
    },
  });
}
