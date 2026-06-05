'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '@/lib/firebase.js';
import { Button, TextField, Typography, Box, Paper } from '@mui/material';
import axios from 'axios';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import AddressMapPicker from '@/components/shared/AddressMapPicker';

export default function CreateCarrier() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
  const router = useRouter();

  const [form, setForm] = useState({
    phone: '',
    otp: '',
    otpSent: false,
    isVerified: false,
    licenseNumber: '',
    aadharNumber: '',
    bankAccount: '',
    profilePic: null,
    address: '',
    location: { latitude: 17.385044, longitude: 78.486671 }, // Hyderabad default
  });
  const [bankAccountError, setBankAccountError] = useState('');
  const [preview, setPreview] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const recaptchaRef = useRef(null);
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    if (!auth) return;
    if (!window.recaptchaVerifier && recaptchaRef.current) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: 'invisible',
      });
    }
  }, [auth]);

  // If carrier already exists, redirect to dashboard
  useEffect(() => {
    const checkExistingCarrier = async () => {
      try {
        if (!user) return;
        const token = await getToken();
        const res = await axios.get(`${API_URL}/api/delivery/getCarrier/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const details = res?.data?.carrier?.delivery_details;
        if (details && (details.phone || details.licenseNumber || details.aadharNumber)) {
          router.push('/carrier/dashboard');
        }
      } catch (e) {
        // ignore if not found
      }
    };
    checkExistingCarrier();
  }, [user, getToken, API_URL, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, profilePic: file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const sendOtp = async () => {
    if (!form.phone) return toast.error('Enter phone number');
    let phoneNumber = form.phone;

    if (process.env.NODE_ENV === 'development') {
      phoneNumber = '+919999999999';
      toast.success('Using test number in dev mode. OTP is 123456');
      setForm({ ...form, otpSent: true });
      return;
    }

    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      setForm({ ...form, otpSent: true });
      toast.success('OTP sent!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to send OTP. Check phone format (+91...) or try again.');
    }
  };

  const verifyOtp = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        if (form.otp === '123456') {
          setForm({ ...form, isVerified: true });
          toast.success('Phone verified ✅ (dev test number)');
          return;
        } else {
          toast.error('Invalid OTP ❌');
          return;
        }
      }
      if (confirmationResult) {
        await confirmationResult.confirm(form.otp);
        setForm({ ...form, isVerified: true });
        toast.success('Phone verified ✅');
      }
    } catch (err) {
      console.error(err);
      toast.error('Invalid OTP ❌');
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.isVerified) return toast.error('Please verify your phone number first!');

    // Validate bank account
    if (!/^\d{9,18}$/.test(form.bankAccount.trim())) {
      setBankAccountError('Bank account number must be 9–18 digits.');
      return;
    }
    setBankAccountError('');

    if (!form.address) {
      toast.error('Please select your address on the map!');
      return;
    }

    let imageData = null;
    if (form.profilePic) {
      if (typeof form.profilePic === 'string' && form.profilePic.startsWith('http')) {
        imageData = form.profilePic;
      } else {
        imageData = await toBase64(form.profilePic);
      }
    }

    const carrierData = {
      phone: form.phone,
      licenseNumber: form.licenseNumber,
      aadharNumber: form.aadharNumber,
      bankAccount: form.bankAccount,
      verified: form.isVerified,
    };

    try {
      const token = await getToken();
      await axios.post(
        `${API_URL}/api/delivery/updateCarrier`,
        {
          carrierData,
          clerkId: user.id,
          profile: imageData,
          address: form.address,
          location: form.location,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Carrier created successfully!');
      router.push('/carrier/dashboard');
    } catch (error) {
      console.error('Error creating carrier:', error);
      toast.error('Failed to create carrier. Please try again.');
    }
  };

  const handleFetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        if (window.google && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            setFetchingLocation(false);
            if (status === "OK" && results[0]) {
              setForm((prev) => ({
                ...prev,
                address: results[0].formatted_address,
                location: { latitude: lat, longitude: lng },
              }));
            } else {
              setForm((prev) => ({
                ...prev,
                address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                location: { latitude: lat, longitude: lng },
              }));
            }
          });
        } else {
          setFetchingLocation(false);
          setForm((prev) => ({
            ...prev,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            location: { latitude: lat, longitude: lng },
          }));
        }
      },
      (error) => {
        setFetchingLocation(false);
        toast.error("Failed to retrieve your location: " + error.message);
      },
      { timeout: 8000 }
    );
  };

  const textFieldSx = {
    '& .MuiInputLabel-root': { color: 'var(--muted-foreground)', fontFamily: 'Poppins, sans-serif', fontWeight: 500 },
    '& .MuiOutlinedInput-root': {
      color: 'var(--foreground)',
      backgroundColor: 'var(--card)',
      borderRadius: 2,
      '& fieldset': { borderColor: 'var(--border)' },
      '&:hover fieldset': { borderColor: 'var(--primary)' },
      '&.Mui-focused fieldset': { borderColor: 'var(--primary)' }
    },
    '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'var(--muted-foreground)', opacity: 1 },
    '& .MuiInputBase-input::placeholder': { color: 'var(--muted-foreground)', opacity: 1 },
    fontSize: '1rem'
  };

  const buttonSx = {
    py: 1.5,
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: 3,
    textTransform: 'none'
  };

  return (
    <Box className="flex justify-center items-center min-h-screen p-6 bg-[var(--background)] text-[var(--foreground)]">
      <Paper
        className={`w-full ${form.isVerified ? 'max-w-6xl' : 'max-w-xl'} p-8 rounded-3xl shadow-2xl border transition-[max-width] duration-300`}
        sx={{ bgcolor: 'var(--card)', color: 'var(--card-foreground)', borderColor: 'var(--border)' }}
      >
        <Typography variant="h3" className="text-center mb-4 font-bold" sx={{ color: 'var(--foreground)', fontFamily: 'Poppins, sans-serif' }}>
          Create Carrier
        </Typography>
        <Typography variant="body1" className="text-center mb-6" sx={{ color: 'var(--muted-foreground)', fontFamily: 'Poppins, sans-serif', fontSize: '1rem' }}>
          Verify your phone number and complete your profile to get started.
        </Typography>

        {!form.isVerified ? (
          <Box className="flex flex-col gap-5">
            <TextField label="Phone Number" placeholder="+91XXXXXXXXXX" value={form.phone} name="phone" onChange={handleChange} fullWidth variant="outlined" sx={textFieldSx} disabled={form.otpSent} />

            {!form.otpSent ? (
              <Button variant="contained" onClick={sendOtp} fullWidth sx={{ ...buttonSx, bgcolor: 'var(--primary)', color: 'var(--primary-foreground)', '&:hover': { opacity: 0.9 } }}>
                Send OTP
              </Button>
            ) : (
              <>
                <TextField label="Enter OTP" value={form.otp} name="otp" onChange={handleChange} fullWidth variant="outlined" sx={textFieldSx} />
                <Button variant="contained" onClick={verifyOtp} fullWidth sx={{ ...buttonSx, bgcolor: 'var(--primary)', color: 'var(--primary-foreground)', '&:hover': { opacity: 0.9 } }}>
                  Verify OTP
                </Button>
              </>
            )}
          </Box>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
            <form onSubmit={handleSubmit} className="md:col-span-3 flex flex-col gap-5">
              <TextField label="License Number" value={form.licenseNumber} name="licenseNumber" onChange={handleChange} fullWidth variant="outlined" sx={textFieldSx} required />
              <TextField label="Aadhar Number" value={form.aadharNumber} name="aadharNumber" onChange={handleChange} fullWidth variant="outlined" sx={textFieldSx} required />
              <div>
                <TextField
                  label="Bank Account Number *"
                  value={form.bankAccount}
                  name="bankAccount"
                  onChange={(e) => {
                    handleChange(e);
                    if (bankAccountError) setBankAccountError('');
                  }}
                  fullWidth
                  variant="outlined"
                  sx={textFieldSx}
                  required
                  inputProps={{ inputMode: 'numeric' }}
                  error={!!bankAccountError}
                  helperText={bankAccountError || 'Required: 9–18 digits'}
                />
              </div>

              <Box>
                <Button variant="contained" component="label" fullWidth sx={{ ...buttonSx, bgcolor: 'var(--muted)', color: 'var(--muted-foreground)', '&:hover': { bgcolor: 'var(--accent)', color: 'var(--accent-foreground)', margin: '0.5rem' } }}>
                  Upload Profile Picture
                  <input type="file" hidden accept="image/*" onChange={handleImage} />
                </Button>
                {preview && (
                  <Box className="mt-4 flex justify-center">
                    <Image src={preview} alt="Profile Preview" width={120} height={120} className="rounded-full object-cover shadow-lg" />
                  </Box>
                )}
              </Box>

              <Button type="submit" variant="contained" fullWidth sx={{ ...buttonSx, bgcolor: 'var(--primary)', color: 'var(--primary-foreground)', '&:hover': { opacity: 0.9 } }}>
                Create Carrier
              </Button>
            </form>

            <div className="md:col-span-2 md:sticky md:top-8 h-fit flex flex-col gap-3">
              <button
                type="button"
                onClick={handleFetchCurrentLocation}
                disabled={fetchingLocation}
                className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
              >
                {fetchingLocation ? "⏳ Fetching Location..." : "📍 Use Current Location"}
              </button>
              <AddressMapPicker
                value={{
                  lat: form.location.latitude,
                  lng: form.location.longitude,
                  address: form.address,
                }}
                onChange={({ lat, lng, address }) =>
                  setForm(prev => ({
                    ...prev,
                    address,
                    location: { latitude: lat, longitude: lng },
                  }))
                }
                label="CARRIER ADDRESS"
                markerPopupText="Your Location"
                mapHeight="calc(100vh - 24rem)"
              />
            </div>
          </div>
        )}

        <div ref={recaptchaRef} id="recaptcha-container" className="mt-6"></div>
      </Paper>
    </Box>
  );
}
