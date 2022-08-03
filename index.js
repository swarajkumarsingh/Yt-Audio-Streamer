const app = require('express')();
const request = require('request');
const ytdl = require('ytdl-core');
const NodeCache = require( "node-cache" );
const audioUrlCache = new NodeCache({ stdTTL: 3600 });

const getVideoAudioUrl = async (videoUrl) => {
    try {
        let streamUrl = audioUrlCache.get(videoUrl) || ""
        if (streamUrl === "") {
            console.log(`Fetching Stream URL`, new Date().getTime())
            const data = await ytdl.getInfo(videoUrl)
            const audioFormat = data.formats.filter(format => format.mimeType.startsWith("audio/"))[0]
            streamUrl = audioFormat.url
            audioUrlCache.set(videoUrl, streamUrl)
        }
        return Promise.resolve(streamUrl)
    } catch (e) {
        return Promise.reject(e)
    }
}

app.get('/', (req, res) => res.json({"message": "Welcome to the Live Streamer"}))

app.get('/stream/:videoId', async (req, res) => {
    let isRequestClose = false
    req.on('close', () => {
        console.log(`Closed`)
        isRequestClose = true
    })

    res.setHeader('content-type', 'audio/mp3')
    res.setHeader('Transfer-Encoding', 'chunked')

    const findAndStream = (res, videoUrl) => {
        getVideoAudioUrl(videoUrl).then((streamUrl) => {
            request({url: streamUrl, encoding: null})
                .on('data', (data) => {
                    if (!isRequestClose) res.write(data)
                })
                .on('end', () => {
                    if (!isRequestClose) findAndStream(res, videoUrl)
                })
                .on('error', (err) => {
                    console.log(`error`, err)
                })

        }).catch(err=>{
            console.log(`Failure retrieving Audio URL`, err)
        });
    }
    try {
        console.log(`Starting steam for video: ${req.params.videoId}`)
        const videoUrl = `http://youtube.com/watch?v=${req.params.videoId}`
        findAndStream(res, videoUrl)
    } catch (err) {
        console.error(err)
        if (!res.headersSent) {
            res.writeHead(500)
            res.end('internal system error')
        }
    }
})

app.listen(3000, function () {
    console.log(`Listening on port ${this.address().port}`)
})