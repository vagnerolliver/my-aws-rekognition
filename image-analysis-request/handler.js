'use strict';
const { get } = require('axios') 

class Handler { 
  constructor({ rekoSvc, translatorScv }) {
    this.rekoSvc = rekoSvc
    this.translatorScv = translatorScv
  }

  async detecImageLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise()

    const workingItems = result.Labels
      .filter(({Confidence}) => Confidence > 80)
    
    const names = workingItems
      .map(({ Name }) => Name)
      .join(' and ') 

    return { names, workingItems }
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }

    const { TranslatedText } = await this.translatorScv
                            .translateText(params)
                            .promise() 

    return TranslatedText.split(' e ')
  }

  formatTextResults(texts, workingItems) { 
    const finalText = []
    for(const indexText in texts) {
      const nameInPortugue = texts[indexText]
      const confidence = workingItems[indexText].Confidence
      finalText.push(
        `${confidence.toFixed(2)}% de ser to tipo ${nameInPortugue}`
      )
    } 
    return finalText.join('\n ')
  }


  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer'
    })

    const buffer = Buffer.from(response.data, 'base64')
    return buffer
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters
      console.log("downloading image...")
      const buffer = await this.getImageBuffer(imageUrl)

      console.log('Detecton label...')
      const { names, workingItems } = await this.detecImageLabels(buffer)
      
      console.log('Translating to Portuguese...')
      const text = await this.translateText(names)

      console.log('handling final object...')
      const finalText = this.formatTextResults(text, workingItems)
      
      return {
        statusCode: 200,
        body: 'A imagem tem\n '.concat(finalText)
      }
    } catch (error) {
      console.log('Erro ******', error.stack)
      return {
        statusCode: 500,
        body: 'Erro interno'
      }
    }
  }
} 


// factory
const aws = require('aws-sdk')
const reko = new aws.Rekognition()
const translator = new aws.Translate()
const handler = new Handler( { 
  rekoSvc: reko,
  translatorScv: translator
})

module.exports.main = handler.main.bind(handler)
