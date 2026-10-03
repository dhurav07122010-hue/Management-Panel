# Secure Remote Access (Tailscale / VPN)

Accessing your server control panel securely from outside your home Wi-Fi network (e.g. mobile cellular data).

---

## ⚠️ Important Security Rule

**DO NOT port-forward port 3001 on your home router directly to the public internet without an encrypted tunnel or VPN!**
Opening server management panels directly to the open internet exposes them to automated internet bot scans and potential zero-day vulnerabilities.

---

## Recommended Solution: Tailscale (Free & Zero-Config VPN)

Tailscale creates a private, encrypted peer-to-peer WireGuard network between your Windows PC and your Android phone.

### Step 1: Install Tailscale on Windows Host
1. Download Tailscale from [https://tailscale.com](https://tailscale.com).
2. Install and sign in.
3. Note your PC's Tailscale IP address (e.g. `100.x.y.z`).

### Step 2: Install Tailscale on Android Phone
1. Install Tailscale from the Google Play Store.
2. Sign in with the same account.
3. Turn on the VPN connection.

### Step 3: Access Control Panel Anywhere
Open your mobile browser and enter:
```
http://100.x.y.z:3001
```
You can now start, stop, monitor console, and install mods from anywhere in the world with encrypted peer-to-peer security.

---

## Alternative: Cloudflare Tunnel

If you prefer a custom domain name:
1. Install `cloudflared` on Windows.
2. Route a private subdomain (e.g. `panel.yourdomain.com`) to `http://localhost:3001`.
3. Enable Cloudflare Zero Trust Access policies (e.g. Google email authentication / 2FA).
