const express = require("express");

const bodyParser = require("body-parser");

const mongoose = require("mongoose");

const path = require("path");

const auth = require("./middleware/auth");

const fs = require("fs");

const multer = require("multer");

const { v4: uuidv4 } = require("uuid");

const { createHandler } = require("graphql-http/lib/use/express");

const graphqlSchema = require("./graphql/schema");
const graphqlResolvers = require("./graphql/resolvers");

require("dotenv").config();

const app = express();

const removeImage = require("./removeImage");

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4());
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpeg"
  )
    cb(null, true);
  else cb(null, false);
};

const MONGODB_URI = process.env.MONGODB_URI;

app.use(bodyParser.json());

app.use(
  multer({ fileFilter: fileFilter, storage: fileStorage }).single("image")
);

app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("Not Authenticated");
  }
  if (!req.file) {
    return res.status(200).json({ message: "No file provided" });
  }
  if (req.body.oldPath) {
    removeImage(req.body.oldPath);
  }
  return res.status(201).json({
    message: "Image is stored",
    imagePath: req.file.path.replace(/\\/g, "/"),
  });
});

app.all(
  "/graphql",
  auth,
  createHandler({
    schema: graphqlSchema,
    rootValue: graphqlResolvers,
    context: async (req) => {
      const expressReq = req.raw;
      return {
        isAuth: expressReq.isAuth,
        userId: expressReq.userId,
      };
    },
    formatError(err) {
      if (!err.originalError) {
        return err;
      }
      const code = err.originalError.code || 500;
      const data = err.originalError.data;
      const message = err.message || "An error occured";
      return { message: message, code: code, data: data };
    },
  })
);

app.use((error, req, res, next) => {
  console.log(error);
  const statusCode = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(statusCode).json({ message: message, data: data });
});

mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    console.log("DB Connected");
    app.listen(process.env.PORT);
  })
  .catch((err) => {
    console.log(err);
  });
