import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { deploymentId, userEmail } = body;

    if (!deploymentId || !userEmail) {
      return NextResponse.json({ error: "Missing deployment details!" }, { status: 400 });
    }

    // Razorpay instance initialize kora hocche
    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    });

    // XPRIZE Demo-r jonno matro 10 Taka
    const options = {
      amount: 1000, 
      currency: "INR",
      receipt: `rcpt_${Date.now()}`, // 👈 EKHANE FIX HOLO (Shortened receipt ID)
      notes: {
        deploymentId: deploymentId, // Notes-e boro URL thakle Razorpay er problem nei
        userEmail: userEmail,
        tier: "PRO"
      }
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("Payment Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}