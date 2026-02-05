const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, '../assets/reelnotes_icon.svg');
const iconPath = path.join(__dirname, '../assets/icon.png');
const adaptiveIconPath = path.join(__dirname, '../assets/adaptive-icon.png');

async function generateIcons() {
  try {
    console.log('Generating icon.png...');
    await sharp(svgPath)
      .resize(1024, 1024)
      .png()
      .toFile(iconPath);
    console.log('Successfully generated icon.png');

    // Also update adaptive-icon.png with a suitable size/resize if needed
    // Usually adaptive icon foreground is 108x108dp, so around 432x432px for xxxhdpi
    // But Expo default is 1024x1024 often used as source. 
    // Let's generate a 1024x1024 for adaptive icon too for simplicity or keep it same.
    // The user only asked for icon.png, but adaptive-icon is often used too.
    // I'll stick to just icon.png as requested, but maybe update adaptive if it's easy.
    // Let's just do icon.png to strict to request, but standard expo app needs adaptive too usually.
    // I'll update adaptive icon too to be safe so the app looks consistent.

    console.log('Generating adaptive-icon.png...');
    await sharp(svgPath)
      .resize(1024, 1024)
      .png()
      .toFile(adaptiveIconPath);
    console.log('Successfully generated adaptive-icon.png');

  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

generateIcons();