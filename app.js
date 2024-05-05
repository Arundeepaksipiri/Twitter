const express = require('express')
const app = express()
app.use(express.json())
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null
const initializeDBAndServer = async () => {
  try {
    app.listen(3000, () => {
      console.log('Server starting http://localhost:3000/')
    })
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
  } catch (e) {
    console.log(`DB Erroe ${e.message}`)
  }
}
initializeDBAndServer()
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.userId = payload.user_id
        next()
      }
    })
  }
}
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const hashedPassword = await bcrypt.hash(request.body.password, 10)
  const selectedUserQuery = `
  SELECT * FROM user WHERE username='${username}'`
  const dbUser = await db.get(selectedUserQuery)
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const createUserQuery = `
    INSERT INTO user (username,password,name,gender)
    VALUES(
      '${username}',
      '${hashedPassword}',
      '${name}',
      '${gender}'
    )`
      await db.run(createUserQuery)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const twitterQuery = `
  SELECT * FROM user WHERE username='${username}'`
  const dbUser = await db.get(twitterQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  let {userId} = request
  const selectUserQuery = `
  SELECT user.username as username, tweet.tweet as tweet,
  tweet.date_time as dateTime FROM (user INNER JOIN follower
  ON user.user_id=follower.following_user_id) as T INNER JOIN tweet ON 
  T.user_id = tweet.user_id WHERE follower.follower_user_id=${userId}`
  const dbUser = await db.all(selectUserQuery)
  response.send(dbUser)
})
app.get('/user/following/', authenticateToken, async (request, response) => {
  let {username} = request
  const selectUserQuery = `
  SELECT user.name as name FROM user INNER JOIN follower ON 
  follower.follower_user_id=user.user_id group by username`
  const dbUser = await db.all(selectUserQuery)
  response.send(dbUser)
})
module.exports = app
