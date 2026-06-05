import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE, MJ_SENDER_EMAIL } = process.env;
console.log("MJ_APIKEY_PUBLIC:", MJ_APIKEY_PUBLIC);
console.log("MJ_APIKEY_PRIVATE:", MJ_APIKEY_PRIVATE);
console.log("MJ_SENDER_EMAIL:", MJ_SENDER_EMAIL);

async function test() {
  try {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${MJ_APIKEY_PUBLIC}:${MJ_APIKEY_PRIVATE}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: MJ_SENDER_EMAIL, Name: "Gathr Test" },
            To: [{ Email: "gathrsmailbox@rediffmail.com", Name: "Receiver" }],
            Subject: "Test Mailjet integration",
            HTMLPart: "<h3>Hello World!</h3><p>Testing Mailjet integration</p>",
          },
        ],
      }),
    });
    console.log("Status Code:", response.status);
    const result = await response.json();
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
