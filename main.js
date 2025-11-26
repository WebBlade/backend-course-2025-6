import http from 'http'
import fs from 'fs'
import path from 'path'
import { program } from 'commander'
import express from 'express'
import multer from 'multer'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'

program
    .option('-h, --host <address>', "Server address", 'localhost')
    .option('-p, --port <number>', "Server port", '8080')
    .option('-c, --cache <path>', "Cache directory path")
    .parse(process.argv)

const options = program.opts()

if (!options.cache) {
    console.error('Error: Required option --cache <path> is missing')
    process.exit(1)
}

const cacheDir = path.resolve(options.cache)
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, cacheDir)
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
})
const upload = multer({ storage: storage })

const app = express()
const swaggerDocument = YAML.load('./swagger.yaml')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.use((req, res, next) => {
    console.log(`[LOG] ${req.method} ${req.url}`)
    next()
})

let inventoryList = []

app.get('/', (req, res) => {
    res.send(`
        <h1>Inventory System</h1>
        <ul>
            <li><a href="/RegisterForm.html">Add New Item (Registration)</a></li>
            <li><a href="/SearchForm.html">Search Item</a></li>
            <li><a href="/inventory">View All Items (JSON)</a></li>
            <li><a href="/docs">Swagger Documentation</a></li>
        </ul>
    `)
})

app.get('/RegisterForm.html', (req, res) => {
    res.sendFile(path.resolve('RegisterForm.html'))
})

app.get('/SearchForm.html', (req, res) => {
    res.sendFile(path.resolve('SearchForm.html'))
})

app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body

    if (!inventory_name) {
        return res.status(400).send('Bad Request: Inventory name is required')
    }

    const newItem = {
        id: Date.now().toString(),
        name: inventory_name,
        description: description || '',
        photo: req.file ? req.file.filename : null
    }

    inventoryList.push(newItem)
    console.log(`[CREATED] Item ${newItem.id} added.`)
    res.status(201).send('Created')
})

app.get('/inventory', (req, res) => {
    const responseList = inventoryList.map(item => ({
        ...item,
        photoUrl: item.photo ? `/inventory/${item.id}/photo` : null
    }))
    res.json(responseList)
})

app.get('/inventory/:id', (req, res) => {
    const item = inventoryList.find(i => i.id === req.params.id)
    if (!item) return res.status(404).send('Not Found')
    
    const responseItem = {
        ...item,
        photoUrl: item.photo ? `/inventory/${item.id}/photo` : null
    }
    res.json(responseItem)
})

app.put('/inventory/:id', express.json(), (req, res) => {
    const item = inventoryList.find(i => i.id === req.params.id)
    if (!item) return res.status(404).send('Not Found')
    
    if (req.body.name) item.name = req.body.name
    if (req.body.description) item.description = req.body.description
    
    res.status(200).send('Updated')
})

app.delete('/inventory/:id', (req, res) => {
    const index = inventoryList.findIndex(i => i.id === req.params.id)
    if (index === -1) return res.status(404).send('Not Found')
    
    const item = inventoryList[index]
    
    if (item.photo) {
        const photoPath = path.join(cacheDir, item.photo)
        if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath)
        }
    }
    
    inventoryList.splice(index, 1)
    res.status(200).send('Deleted')
})

app.get('/inventory/:id/photo', (req, res) => {
    const item = inventoryList.find(i => i.id === req.params.id)
    if (!item || !item.photo) return res.status(404).send('Not Found')
    
    const photoPath = path.join(cacheDir, item.photo)
    if (fs.existsSync(photoPath)) {
        res.setHeader('Content-Type', 'image/jpeg')
        fs.createReadStream(photoPath).pipe(res)
    } else {
        res.status(404).send('Photo file missing')
    }
})

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventoryList.find(i => i.id === req.params.id)
    if (!item) return res.status(404).send('Not Found')
    
    if (req.file) {
        if (item.photo) {
            const oldPath = path.join(cacheDir, item.photo)
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
        }
        item.photo = req.file.filename
        res.status(200).send('Photo Updated')
    } else {
        res.status(400).send('No photo uploaded')
    }
})

app.post('/search', (req, res) => {
    const { id, includePhoto } = req.body
    const item = inventoryList.find(i => i.id === id)

    if (!item) return res.status(404).send('Not Found')

    let resultDescription = item.description
    if (includePhoto === 'on' && item.photo) {
        resultDescription += ` (Photo link: /inventory/${item.id}/photo)`
    }

    res.json({
        id: item.id,
        name: item.name,
        description: resultDescription
    })
})

const server = http.createServer(app)
server.listen(options.port, options.host, () => {
    console.log(`Server started on http://${options.host}:${options.port}`)
    console.log(`Swagger docs at http://${options.host}:${options.port}/docs`)
})