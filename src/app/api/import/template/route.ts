// Member import template. Headers cover every field the importer can map
// today, including the demographics Jamie requested for new manual adds
// (gender, address, referred_by, dob). Phone, dob and gender are required
// for *manual* signup but optional in CSV import — legacy data from other
// platforms rarely has all three, so we accept blank cells without
// failing the row.
//
// Columns are grouped: identity → demographics → plan/admin → minor
// fields → notes. Three sample rows cover the most common shapes:
// an adult monthly subscriber, a drop-in with sparse demographics
// (representing a "we just have name+email" import from another platform),
// and a minor with a separate guardian email.
const TEMPLATE_CSV = `First Name,Last Name,Email,Phone,Date of Birth,Gender,Address,Referred By,Tags,Plan Type,Credits,Status,Notes,Is Minor,Guardian Email
Jane,Doe,jane@example.com,555-123-4567,1992-04-15,female,"123 Main St, Portland, OR 97201",Instagram,veteran,monthly,,active,Prefers morning classes,false,
Alex,Kim,alex.kim@example.com,,,,,,"first_responder; new_member",drop_in,0,active,,false,
Sam,Lee,sam.lee@example.com,,2012-08-22,,,,,pack,10,active,Started in kids' yoga,true,parent.lee@example.com`;

export async function GET() {
  return new Response(TEMPLATE_CSV, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="klasly-member-import-template.csv"',
    },
  });
}
