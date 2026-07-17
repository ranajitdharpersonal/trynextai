import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text(); // Raw text format lage Razorpay verification er jonno
    const headers = req.headers;
    const signature = headers.get('x-razorpay-signature');

    // Razorpay theke ekta secret asbe jeta amra pore env te boshabo
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("Webhook secret missing");

    // Security Check: Keu jeno fake payment success na pathate pare
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyText)
      .digest('hex');

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature! Hacker alert!" }, { status: 400 });
    }

    const event = JSON.parse(bodyText);

    // Jokhon sotti i payment ta account e dhuke jabe
    if (event.event === 'payment.captured') {
      const paymentData = event.payload.payment.entity;
      const deploymentId = paymentData.notes.deploymentId;

      if (deploymentId) {
        console.log(`💸 Payment success for ${deploymentId}. Upgrading to PRO...`);

        // ==============================================================
        // 💾 AWS DYNAMODB UPDATE LOGIC (FREE -> PRO)
        // ==============================================================
        const dbClient = new DynamoDBClient({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
          },
        });
        const docClient = DynamoDBDocumentClient.from(dbClient);

        // 30 days (1 month) validity bariye dicchi
        const newExpiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000);

        await docClient.send(new UpdateCommand({
          TableName: "TryNext_Deployments",
          Key: { deploymentId: deploymentId },
          UpdateExpression: "set tier = :t, expiresAt = :e",
          ExpressionAttributeValues: {
            ":t": "PRO",
            ":e": newExpiryTime,
          },
        }));
        console.log(`✅ AWS Updated! ${deploymentId} is now officially PRO!`);
        // ==============================================================
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}