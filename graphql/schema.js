const { buildSchema } = require("graphql");
module.exports = buildSchema(`
    type Post {
        _id: ID!
        title: String!
        content: String!
        imageUrl: String!
        creator: User!
        createdAt: String!
        updatedAt: String!
    }

    type User {
        _id :ID!
        name: String!
        email: String!
        password: String
        status: String!
        posts: [Post!]!
    }

    input userInputData {
        name :String!
        email :String!
        password :String!
    }
    type AuthData {
        token:String!
        userId:String!
    }
    type postsData {
        posts:[Post!]!
        totalPosts:Int!
    }
    type RootQuery {
        login(email:String! , password:String!):AuthData!
        getPosts(page:Int!):postsData!
        getPost(postId:ID!):Post!
        getUser:User!
    }

    input postInputData {
        title:String!
        content:String!
        imageUrl:String!
    }

    type RootMutation {
        createUser(userInput :userInputData):User!
        createPost(postData: postInputData):Post!
        editPost(postId:ID!,postData:postInputData!):Post!
        deletePost(postId:ID!):Boolean!
        updateStatus(status:String):User!
    }

    schema {
        query: RootQuery
        mutation : RootMutation
    }
`);
