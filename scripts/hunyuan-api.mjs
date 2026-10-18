import { Client } from '../tmp-tools/node_modules/@gradio/client/dist/index.js'

const client = await Client.connect(process.argv[2] || 'tencent/Hunyuan3D-2mini-Turbo')
for (const [name, endpoint] of Object.entries(client.api_info.named_endpoints)) {
  const params = (endpoint.parameters || []).map((item) => item.parameter_name).join(', ')
  console.log(name, '::', params)
}
