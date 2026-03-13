const TEMPLATE_CSV = `Name,Email,Phone,Bio,Specialties
Jane Smith,jane@example.com,555-100-2000,"Certified yoga instructor with 10 years experience","yoga, pilates, meditation"
Bob Lee,bob@example.com,555-200-3000,"Dance and fitness coach","hip-hop, zumba"`;

export async function GET() {
  return new Response(TEMPLATE_CSV, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="klasly-instructor-import-template.csv"',
    },
  });
}
