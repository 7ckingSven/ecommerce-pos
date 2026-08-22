import qrcode
from PIL import Image

# APK download URL — now hosted on Flask backend for faster, more reliable downloads
# Change this to your deployed domain in production (e.g., https://yourdomain.com/download-apk)

#Change the URL "https://drive.google.com/uc?export=download&id= "
url = "https://ecommerce-pos-8rsf.onrender.com/download-apk"

# Create QR code with green branding
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,
    border=4,
)
qr.add_data(url)
qr.make(fit=True)

# Generate image with your brand colors
img = qr.make_image(fill_color="#16a34a", back_color="white")

# Save to static folder so Flask can serve it
img.save("backend/static/img/app-qr-code.png")
print("✓ QR code generated: backend/static/img/app-qr-code.png")
print(f"✓ QR code points to: {url}")
print("✓ NOTE: Update URL for production deployment")