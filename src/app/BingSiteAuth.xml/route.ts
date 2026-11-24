export async function GET() {
  const content = `<?xml version="1.0"?>
<users>
\t<user>07C29F14CA7B92CB563BA3ECF71CCE81</user>
</users>`;

  return new Response(content, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
