import { Command } from "commander"
import fs from "fs/promises"
import request from "superagent"
import path from "path"
import http from "http"

const program = new Command()

program
    .name("WebBackend-6")
    .description("")
    .version("1.0.0")

program
    .requiredOption("-p, --port <number>", "Server port")
    .requiredOption("-h, --host <string>", "Server host", "localhost")
    .requiredOption("-c, --cache <path>", "Directory to cache")

program.parse(process.argv)
const options = program.opts()

if(!options.port || !options.host || !options.cache){
    console.error('Please input all required options (port / host / cache path)')
    process.exit(1)
}

const cachePath = path.resolve(options.cache)

try {
    await fs.access(cachePath)
    console.log(`Your directory is already exists: ${cachePath}`)
} catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(cachePath, { recursive: true });
      console.log(`Your directory successfully created: ${cachePath}`)
    } else {
      console.error('Error setting up cache directory: ', error)
      process.exit(1);
    }
}

const server = http.createServer(async (req, res) => {

})

server.listen(options.port, options.host , () => {
    console.log(`Server is started on http://${options.host}:${options.port}`)
})