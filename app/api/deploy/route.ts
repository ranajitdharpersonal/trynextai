import { NextResponse } from 'next/server';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { htmlCode, appName } = body;

    if (!htmlCode) {
      return NextResponse.json({ error: "Kono code asheni deploy korar jonno!" }, { status: 400 });
    }

    const TRYNEXT_DEPLOY_KEY = process.env.TRYNEXT_DEPLOY_KEY;
    if (!TRYNEXT_DEPLOY_KEY) {
      throw new Error("Vercel Token missing in .env.local");
    }

    console.log(`🚀 Deploying app to Vercel Production...`);

    // ==============================================================
    // ⏳ THE 48-HOUR TIME BOMB MAGIC (Auto Expiration)
    // ==============================================================
    // Current time er sathe theek 48 hours (2 days) add kora hocche
    const expiryTime = Date.now() + (48 * 60 * 60 * 1000); 
    
    // Ei script ta chupchap user er code e inject hoye jabe
    const timeBombScript = `
    <script>
      (function() {
        const expiry = ${expiryTime};
        if (Date.now() > expiry) {
          document.addEventListener("DOMContentLoaded", function() {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#050505;color:#ef4444;font-family:monospace;flex-direction:column;text-align:center;padding:20px;"><h1>⏳ SANDBOX EXPIRED</h1><p style="color:#a3a3a3;margin-top:10px;font-size:14px;">This TryNext AI sandbox environment was valid for 48 hours.<br>Deploy a new version to continue.</p></div>';
            document.head.innerHTML = '<title>Expired - TryNext AI</title>';
          });
        }
      })();
    </script>
    `;

    // Code er <head> tag er theek aage time bomb ta bosiye dicchi
    if (htmlCode.includes('</head>')) {
      htmlCode = htmlCode.replace('</head>', `${timeBombScript}\n</head>`);
    } else {
      htmlCode = timeBombScript + htmlCode;
    }
    // ==============================================================

    // Vercel Direct Deployment Payload
    const payload = {
      name: "trynext-ai-sandbox", // Masterstroke: Ektai project name thakbe jate limit hit na hoy
      target: "production",       // 🚀 PRODUCTION TARGET: 100% Public, No Sign-up required!
      files: [
        {
          file: "index.html",
          data: htmlCode
        }
      ],
      projectSettings: {
        framework: null
      }
    };

    // Calling Vercel API
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRYNEXT_DEPLOY_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Vercel Error:", data);
      throw new Error(data.error?.message || "Deployment failed");
    }

    // Vercel return kore url (e.g., something.vercel.app)
    const liveUrl = `https://${data.url}`;
    console.log(`✅ App Deployed: ${liveUrl}`);

    // ==============================================================
    // 💾 AWS DYNAMODB INJECTION (Phase 1: Zero Stack Hackathon)
    // ==============================================================
    try {
      console.log("💾 Saving deployment to AWS DynamoDB...");
      
      const dbClient = new DynamoDBClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
        },
      });
      const docClient = DynamoDBDocumentClient.from(dbClient);

      await docClient.send(new PutCommand({
        TableName: "TryNext_Deployments",
        Item: {
          deploymentId: data.id || `dep_${Date.now()}`,
          appName: appName || "TryNext_App",
          url: liveUrl,
          tier: "FREE",
          expiresAt: expiryTime,
          createdAt: Date.now()
        }
      }));
      console.log("✅ Data successfully saved to AWS DynamoDB!");
    } catch (awsError) {
      console.error("⚠️ AWS DynamoDB Error:", awsError);
      // Ekhane error asleo user app deployer URL peye jabe, app crash korbe na!
    }
    // ==============================================================

    return NextResponse.json({ success: true, url: liveUrl });

  } catch (error: any) {
    console.error("Deployment crashed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}