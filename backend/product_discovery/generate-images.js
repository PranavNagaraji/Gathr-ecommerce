import dotenv from "dotenv";
import fs from "fs";
import axios from "axios";
import products from "./products.js";
import { v2 as cloudinary } from "cloudinary";

dotenv.config({
  path: "../.env",
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PEXELS_KEY = process.env.PEXELS_API_KEY;

if (!PEXELS_KEY) {
  throw new Error("PEXELS_API_KEY not found");
}

async function searchImage(query) {
  const { data } = await axios.get(
    "https://api.pexels.com/v1/search",
    {
      params: {
        query,
        per_page: 1,
      },
      headers: {
        Authorization: PEXELS_KEY,
      },
    }
  );

  if (!data.photos?.length) {
    throw new Error(`No image found for "${query}"`);
  }

  return data.photos[0].src.large;
}

async function uploadToCloudinary(imageUrl) {
  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: "seed-products",
  });

  return {
    url: result.secure_url,
    public_id: result.public_id,
  };
}

async function main() {
  const finalProducts = [];

  for (const product of products) {
    try {
      console.log(`Processing: ${product.name}`);

      const imageUrl = await searchImage(product.imageQuery);

      console.log(`Found image`);

      const uploaded = await uploadToCloudinary(imageUrl);

      console.log(`Uploaded to Cloudinary`);

      finalProducts.push({
        name: product.name,
        description: product.description,
        quantity: product.quantity,
        price: product.price,
        category: product.category,
        shop_id: product.shop_id,
        sold_qt: 0,
        images: [uploaded],
      });

      console.log(`✓ ${product.name}`);
    } catch (err) {
      console.error(`✗ ${product.name}`);
      console.error(err.message);
    }
  }

  fs.writeFileSync(
    "./generated-data.json",
    JSON.stringify(finalProducts, null, 2)
  );

  console.log(
    `Generated ${finalProducts.length} products successfully`
  );
}

main();