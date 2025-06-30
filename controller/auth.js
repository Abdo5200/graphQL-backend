const express = require("express");

const User = require("../models/user");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const { validationResult } = require("express-validator");

const errorCall = (err, next) => {
  if (!err.statusCode) err.statusCode = 500;
  next(err);
};

const clientSideError = (message, errorCode) => {
  const error = new Error(message);
  error.statusCode = errorCode;
  throw error;
};

const validationErrorCall = (arrayData) => {
  const error = new Error("Validation Failed");
  error.statusCode = 422;
  error.data = arrayData;
  throw error;
};

/**
 * @param {express.Request} req
 * @param {express.Response} res
 */

exports.signup = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      validationErrorCall(errors.array());
    }
    const email = req.body.email;
    const name = req.body.name;
    const password = req.body.password;
    const hashedPass = await bcrypt.hash(password, 12);
    const user = new User({
      email: email,
      name: name,
      password: hashedPass,
    });
    const savedUser = await user.save();
    res
      .status(201)
      .json({ message: "created user successfully", userId: savedUser._id });
  } catch (err) {
    errorCall(err, next);
  }
};

/**
 * @param {express.Request} req
 * @param {express.Response} res
 */

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      validationErrorCall(errors.array());
    }
    const email = req.body.email;
    const password = req.body.password;
    const user = await User.findOne({ email: email });
    if (!user) {
      clientSideError("Email does not exist", 401);
    }
    const validatePass = await bcrypt.compare(password, user.password);
    if (!validatePass) {
      clientSideError("Password is wrong", 401);
    }
    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      process.env.API_SECRET,
      { expiresIn: "1h" }
    );
    res.status(200).json({
      message: "Logged in successfully",
      token: token,
      userId: user._id.toString(),
    });
  } catch (err) {
    errorCall(err, next);
  }
};
