const User = require("../models/user");
const Post = require("../models/post");
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const removeImage = require("../removeImage");
let createError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};
let createErrorWithData = (message, code, arrOfErrors) => {
  const error = new Error(message);
  error.code = code;
  error.data = arrOfErrors;
  throw error;
};
const POSTS_PER_PAGE = 2;
module.exports = {
  createUser: async function ({ userInput }, req) {
    let errors = [];
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: "Email is invalid" });
    }
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: "Password is too short" });
    }
    if (errors.length > 0) {
      createErrorWithData("Invalid Input from the resolver", 422, errors);
    }
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error("That user already existing");
      throw error;
    }
    const hashedPass = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPass,
    });
    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },
  login: async function ({ email, password }, req) {
    let errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: "Email is invalid" });
    }
    if (
      validator.isEmpty(password) ||
      !validator.isLength(password, { min: 5 })
    ) {
      errors.push({ message: "Password is too short" });
    }
    if (errors.length > 0) {
      createErrorWithData("Invalid Input", 422, errors);
    }
    const user = await User.findOne({ email: email });
    if (!user) {
      createError("User is not found", 401);
    }
    const checkPassword = bcrypt.compare(password, user.password);
    if (!checkPassword) {
      createError("Password is invalid", 422);
    }
    const token = jwt.sign(
      { email: email, userId: user._id },
      process.env.API_SECRET,
      { expiresIn: "1h" }
    );
    return { userId: user._id.toString(), token: token };
  },
  createPost: async function ({ postData }, req) {
    if (!req.isAuth) {
      createError("Not Authenticated", 401);
    }
    let errors = [];
    if (!validator.isLength(postData.title, { min: 5 })) {
      errors.push({ message: "Title is too short" });
    }
    if (!validator.isLength(postData.content, { min: 5 })) {
      errors.push({ message: "Content is too short" });
    }
    if (validator.isEmpty(postData.imageUrl)) {
      errors.push({ message: "Image url is empty" });
    }
    if (errors.length > 0) {
      createErrorWithData("Invalid input data", 422, errors);
    }
    const user = await User.findById(req.userId);
    if (!user) {
      createError("User not found", 404);
    }
    const post = new Post({
      title: postData.title,
      content: postData.content,
      imageUrl: postData.imageUrl,
      creator: user,
    });
    user.posts.push(post);
    const savedPost = await post.save();
    await user.save();
    return {
      ...savedPost._doc,
      _id: savedPost._id.toString(),
      createdAt: savedPost.createdAt.toISOString(),
      updatedAt: savedPost.updatedAt.toISOString(),
    };
  },
  getPosts: async function ({ page }, req) {
    if (!req.isAuth) {
      createError("Not Authenticated", 401);
    }
    if (!page) {
      page = 1;
    }
    const numOfPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * POSTS_PER_PAGE)
      .limit(POSTS_PER_PAGE)
      .populate("creator");
    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: numOfPosts,
    };
  },
  getPost: async function ({ postId }, req) {
    if (!req.isAuth) {
      createError("Not Authenticated", 401);
    }
    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      createError("Post not found", 404);
    }
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },
  editPost: async function ({ postId, postData }, req) {
    if (!req.isAuth) {
      createError("Not Authenticated", 401);
    }
    let errors = [];
    if (!validator.isLength(postData.title, { min: 5 })) {
      errors.push({ message: "Title is too short" });
    }
    if (!validator.isLength(postData.content, { min: 5 })) {
      errors.push({ message: "Content is too short" });
    }
    if (validator.isEmpty(postData.imageUrl)) {
      errors.push({ message: "Image url is empty" });
    }
    if (errors.length > 0) {
      createErrorWithData("Invalid input data", 422, errors);
    }
    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      createError("Post not found", 404);
    }
    if (req.userId.toString() !== post.creator._id.toString()) {
      createError("Not Authorized", 403);
    }
    post.title = postData.title;
    post.content = postData.content;
    if (postData.imageUrl !== "undefined") {
      post.imageUrl = postData.imageUrl;
    }
    const updatedPost = await post.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
  deletePost: async function ({ postId }, req) {
    if (!req.isAuth) {
      createError("Not Authenticated", 401);
    }
    const post = await Post.findById(postId);
    if (!post) {
      createError("Post not found", 404);
    }
    const user = await User.findById(req.userId);
    if (!user) {
      createError("User not found", 403);
    }
    if (post.creator.toString() !== req.userId.toString()) {
      createError("Not Authorized", 422);
    }
    user.posts = user.posts.filter((p) => {
      p._id.toString() === post._id.toString();
    });
    user.save();
    removeImage(post.imageUrl);
    await Post.findByIdAndDelete(postId);
    return true;
  },
  getUser: async function (args, req) {
    if (!req.isAuth) {
      createError("Not Authenticated", 401);
    }
    const user = await User.findById(req.userId);
    if (!user) {
      createError("User not found", 404);
    }
    return { ...user._doc, _id: user._id.toString() };
  },
  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      createError("Not Authenticated", 401);
    }
    const user = await User.findById(req.userId);
    if (!user) {
      createError("User not found", 404);
    }
    user.status = status;
    const updatedUser = await user.save();
    return { ...updatedUser._doc, _id: updatedUser._id.toString() };
  },
};
