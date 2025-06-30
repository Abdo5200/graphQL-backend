const path = require("path");
const fs = require("fs");
module.exports = (imagePath) => {
  imagePath = path.join(__dirname, imagePath);
  fs.unlink(imagePath, (err) => {
    console.log(err);
  });
};
