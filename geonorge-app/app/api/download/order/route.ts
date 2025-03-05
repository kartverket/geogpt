import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Format the request body for the Geonorge API
    const orderRequest = {
      email: "",
      usageGroup: body.userGroup,
      softwareClient: "GeoGpt",
      softwareClientVersion: "0.1.0",
      orderLines: [
        {
          metadataUuid: body.metadataUuid,
          areas: [
            {
              code: body.area.code,
              name: body.area.name,
              type: body.area.type,
            },
          ],
          projections: [
            {
              code: body.projection.code,
              name: body.projection.name,
              codespace: body.projection.codespace,
            },
          ],
          formats: [
            {
              name: body.format.name,
            },
          ],
          usagePurpose: body.purpose,
        },
      ],
    };

    // Make the request to Geonorge API
    const response = await fetch("https://nedlasting.geonorge.no/api/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://kartkatalog.geonorge.no",
        Referer: "https://kartkatalog.geonorge.no/",
      },
      body: JSON.stringify(orderRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Geonorge API error:", errorText);
      return NextResponse.json(
        { error: `Geonorge API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error processing download request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
