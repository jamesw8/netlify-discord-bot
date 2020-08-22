const express = require('express')
const app = express()
const port = 3000
const { loginDiscordClient, sendBuildInfo } = require('./discordClient')

let in_progress_builds = {}

app.use(express.json());

app.get('/', (req, res) => {
  let dateString = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  console.log(`Pinged at ${dateString} EST`)
  res.send('Hello World!')
})

app.post('/netlify-webhook', (req, res) => {
  console.log(`Handling ${req.body.state}`)
  handleBuild(req.body)

  res.end('Success')
})

app.get('/test', (req, res) => {
  sendBuildInfo('test')
})

loginDiscordClient()
  .then(res => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Example app listening on port ${port}`)
    })
  })

function handleBuild(build) {
  switch(build.state) { 
    case 'building':
      enqueueBuild(build);
      break;
    case 'ready': 
      completeBuild(build);
      break;
    case 'error':
      failBuild(build);
      break;
  }
}

function enqueueBuild(build) {
  if (in_progress_builds[build.id]) {
    console.log(`${build.id} already in queue`)
    return
  }
  
  notifyStart(build).then(res => {
    in_progress_builds[build.id] = {
      message: res,
      info: build
    }
  })
}
function completeBuild(build) {
  if (in_progress_builds[build.id == null]) {
    console.log(`${build.id} is not in queue`)
    return
  }

  notifySuccess(build).then(res => {
   removeBuildFromQueue(build) 
  })

}
function failBuild(build) {
  if (in_progress_builds[build.id == null]) {
    console.log(`${build.id} is not in queue`)
    return
  }

  notifyFailure(build).then(res => {
   removeBuildFromQueue(build) 
  })
}
function removeBuildFromQueue(build) {
  in_progress_builds[build.id] ? delete in_progress_builds[build.id] : null
}

/* 
  Discord message handling
  ------------------------
  Schema: ${context} (${title}): ${state}\n
          ${created_at}: ${commiter} triggered branch ${branch} deploy with commit ${commit_url}\n
          ${updated_at}: {{ state==error ? ${error_message} : Successfully deployed at ${deploy_ssl_url} }}. Build finished in ${deploy_time} seconds.
*/

function notifyStart(build) {
  let build_info = constructInitialMessage(build)

  return sendBuildInfo(build_info)
}
function notifySuccess(build) {
  let state = build.state
  let updated_at = convertToDateString(build.updated_at)
  let deploy_url = build.deploy_ssl_url
  let deploy_time = build.deploy_time
  
  let build_info = constructInitialMessage(build)
  let update = `\n***${updated_at}:*** Successfully deployed at ${deploy_url}. Build finished in ${deploy_time} seconds.`
  build_info += update

  return in_progress_builds[build.id].message.edit(build_info)
}
function notifyFailure(build) {
  let error_message = build.error_message
  let updated_at = convertToDateString(build.updated_at)
  
  let build_info = constructInitialMessage(build)
  let update = `\n***${updated_at}:*** ${error_message}`
  build_info += update

  return in_progress_builds[build.id].message.edit(build_info)
}

function constructInitialMessage(build) {
  let context = build.context.toUpperCase()
  let title = build.title
  let state = build.state
  let created_at = convertToDateString(build.created_at)
  let committer = build.committer
  let branch = build.branch
  let commit_url = build.commit_url
  let state_string
  switch(state) {
    case 'building':
      state_string = `\`\`\`fix\n${state.toUpperCase()}\`\`\``
      break
    case 'ready':
      state_string = `\`\`\`diff\n+${state.toUpperCase()}\`\`\``
      break
    case 'error':
      state_string = `\`\`\`css\n[${state.toUpperCase()}]\`\`\``
      break
  }
  return (
    `>>> **${context} ${branch}** \`${title}\`: ${state_string}***${created_at}:*** \`${committer}\` triggered deploy with commit ${commit_url}.`
  )
}

function convertToDateString(datetime) {
  return new Date(datetime).toLocaleString('en-US', { timeZone: 'America/New_York' })
}