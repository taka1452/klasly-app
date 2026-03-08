const TEMPLATE_CSV = `Name,Day of Week,Start Time,Duration (minutes),Capacity,Description,Location,Instructor Email
Morning Yoga,Monday,09:00,60,15,Gentle flow for all levels,Studio A,jane@example.com
Evening HIIT,Wednesday,18:30,45,20,High intensity interval training,Main Floor,
Weekend Dance,Saturday,10:00,60,25,Fun dance class for beginners,Studio B,bob@example.com`;

export async function GET() {
  return new Response(TEMPLATE_CSV, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="klasly-class-import-template.csv"',
    },
  });
}
