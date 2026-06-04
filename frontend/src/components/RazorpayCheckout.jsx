// Complete Razorpay Checkout Component
'use client';
import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function RazorpayCheckout({ items, totalPrice, addressId }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const handleRazorpayCheckout = async () => {
    if (!user || !items || items.length === 0) {
      toast.error("No items to checkout");
      return;
    }

    if (!addressId) {
      toast.error("Please select a shipping address");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();

      // Step 1: Load Razorpay script
      const loadRazorpayScript = () => {
        return new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Razorpay SDK failed to load. Please check your connection.");
        return;
      }
      
      // Step 2: Create order from cart
      const orderResponse = await axios.post(
        `${API_URL}/razorpay/create-order-from-cart`,
        { clerkId: user.id, addressId },
        { 
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
          } 
        }
      );
      
      const orderId = orderResponse.data.order.id;
      
      // Step 3: Create Razorpay order
      const checkoutResponse = await axios.post(
        `${API_URL}/razorpay/create-checkout-session`,
        { 
          orderId: orderId, 
          clerkId: user.id 
        },
        { 
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
          } 
        }
      );
      
      // Step 4: Open Razorpay checkout overlay
      const options = {
        key: checkoutResponse.data.key,
        amount: checkoutResponse.data.amount,
        currency: checkoutResponse.data.currency,
        name: checkoutResponse.data.name,
        description: checkoutResponse.data.description,
        order_id: checkoutResponse.data.order_id,
        handler: async function (response) {
          try {
            const verifyResponse = await axios.post(
              `${API_URL}/razorpay/verify-payment`,
              {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                clerkId: user.id,
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (verifyResponse.data.success) {
              toast.success("Payment successful!");
              router.push(`/payment-success?session_id=${response.razorpay_order_id}`);
            } else {
              toast.error("Payment verification failed.");
              router.push("/payment-cancelled");
            }
          } catch (err) {
            console.error("Verification error:", err);
            toast.error("Verification failed.");
            router.push("/payment-cancelled");
          }
        },
        prefill: {
          name: user.fullName || "",
          email: user.primaryEmailAddress?.emailAddress || "",
        },
        theme: {
          color: "#3B82F6",
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        toast.error("Payment failed: " + response.error.description);
        router.push("/payment-cancelled");
      });
      rzp.open();
      
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 border-t pt-4 text-right">
      <p className="text-lg font-semibold">
        Total: ₹{totalPrice.toFixed(2)}
      </p>
      <button 
        className={`p-2 rounded-lg m-2 font-medium ${
          loading 
            ? "bg-gray-400 text-gray-600 cursor-not-allowed" 
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
        onClick={handleRazorpayCheckout}
        disabled={loading}
      >
        {loading ? "Processing..." : "Pay with Razorpay"}
      </button>
    </div>
  );
}
