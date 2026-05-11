import qrcode
from PIL import Image

# APK download link from Google Drive
url = "https://drive.google.com/uc?export=download&confirm=t&id=1X_LIKE0AqL3wY6GKdnKIhzMTf9gzSjRq"

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
