'use client';

import { useState, useEffect } from 'react';
import { Button, TextField, Typography, Box, Paper } from '@mui/material';
import axios from 'axios';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import AddressMapPicker from '@/components/shared/AddressMapPicker';

export default function UpdateCarrier() {
    const { user } = useUser();
    const { getToken } = useAuth();
    const router = useRouter();
    const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

    const [form, setForm] = useState({
        phone: '',
        licenseNumber: '',
        aadharNumber: '',
        bankAccount: '',
        address: '',
        location: { latitude: 17.385044, longitude: 78.486671 }, // Hyderabad default
    });
    const [bankAccountError, setBankAccountError] = useState('');
    const [fetchingLocation, setFetchingLocation] = useState(false);

    // Fetch carrier info on mount
    useEffect(() => {
        const fetchCarrier = async () => {
            if (!user) return;
            try {
                const token = await getToken();
                const res = await axios.get(`${API_URL}/api/delivery/getCarrier/${user.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = res.data.carrier?.delivery_details || {};
                const addressData = res.data.address || {};
                setForm({
                    phone: data.phone || '',
                    licenseNumber: data.licenseNumber || '',
                    aadharNumber: data.aadharNumber || '',
                    bankAccount: data.bankAccount || '',
                    address: addressData.address || '',
                    location: addressData.location
                        ? { latitude: addressData.location.lat, longitude: addressData.location.long }
                        : { latitude: 17.385044, longitude: 78.486671 },
                });
            } catch (error) {
                console.error('Error fetching carrier:', error);
            }
        };
        fetchCarrier();
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate bank account
        if (!/^\d{9,18}$/.test((form.bankAccount || '').trim())) {
            setBankAccountError('Bank account number must be 9-18 digits.');
            return;
        }
        setBankAccountError('');

        if (!form.address) {
            toast.error('Please select your address on the map!');
            return;
        }

        const carrierData = {
            licenseNumber: form.licenseNumber,
            bankAccount: form.bankAccount,
            phone: form.phone,
            aadharNumber: form.aadharNumber,
        };

        try {
            const token = await getToken();
            await axios.post(
                `${API_URL}/api/delivery/updateCarrier`,
                {
                    carrierData,
                    clerkId: user.id,
                    address: form.address,
                    location: form.location,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Carrier updated successfully!');
            router.push('/carrier/dashboard');
        } catch (error) {
            console.error('Error updating carrier:', error);
            toast.error('Failed to update carrier. Check console for details.');
        }
    };

    return (
        <Box className="flex justify-center items-center min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6 md:p-10">
            <Paper className="w-full max-w-5xl p-8 md:p-10 rounded-3xl shadow-lg border border-[var(--border)]" style={{ background: 'var(--card)', color: 'var(--card-foreground)' }}>
                <Typography variant="h4" className="text-center mb-8 font-bold" component="h1" sx={{ color: 'var(--foreground)' }}>
                    Update Carrier
                </Typography>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
                    {/* LEFT: Details */}
                    <form onSubmit={handleSubmit} className="md:col-span-3 flex flex-col gap-6">
                        <TextField
                            label="Phone Number"
                            value={form.phone}
                            fullWidth
                            variant="outlined"
                            disabled
                            InputLabelProps={{ style: { color: 'var(--muted-foreground)' } }}
                            inputProps={{ style: { color: 'var(--card-foreground)' } }}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'var(--muted-foreground)', fontFamily: 'inherit' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--ring)' },
                                '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'var(--foreground)' }
                            }}
                        />

                        <TextField
                            label="License Number"
                            value={form.licenseNumber}
                            name="licenseNumber"
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            required
                            InputLabelProps={{ style: { color: 'var(--muted-foreground)' } }}
                            inputProps={{ style: { color: 'var(--card-foreground)' } }}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'var(--muted-foreground)', fontFamily: 'inherit' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--ring)' }
                            }}
                        />

                        <TextField
                            label="Aadhar Number"
                            value={form.aadharNumber}
                            fullWidth
                            variant="outlined"
                            disabled
                            InputLabelProps={{ style: { color: 'var(--muted-foreground)' } }}
                            inputProps={{ style: { color: 'var(--card-foreground)' } }}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'var(--muted-foreground)', fontFamily: 'inherit' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--ring)' },
                                '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'var(--foreground)' }
                            }}
                        />

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
                            required
                            inputProps={{ style: { color: 'var(--card-foreground)' }, inputMode: 'numeric' }}
                            InputLabelProps={{ style: { color: 'var(--muted-foreground)' } }}
                            error={!!bankAccountError}
                            helperText={bankAccountError || 'Required: 9\u201318 digits'}
                            sx={{
                                '& .MuiInputLabel-root': { color: 'var(--muted-foreground)', fontFamily: 'inherit' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: bankAccountError ? 'rgb(239 68 68)' : 'var(--border)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--ring)' }
                            }}
                        />

                        <Button type="submit" variant="contained" fullWidth style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                            Update Carrier
                        </Button>
                    </form>

                    {/* RIGHT: Address */}
                    <div className="md:col-span-2 md:sticky md:top-8 h-fit flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={handleFetchCurrentLocation}
                            disabled={fetchingLocation}
                            className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
                        >
                            {fetchingLocation ? "Fetching Location..." : "Use Current Location"}
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
            </Paper>
        </Box>
    );
}