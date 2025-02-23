import fs from 'fs'
import cmdConstant from './cmd_constant.js'
import * as k8s from '@kubernetes/client-node'

const resourceMap = new Map([
    ['po', 'pods'], ['pod', 'pods'], ['pods', 'pods'],
    ['deploy', 'deployments'], ['deployment', 'deployments'], ['deployments', 'deployments'],
    ['svc', 'services'], ['service', 'services'], ['services', 'services'],
    ['no', 'nodes'], ['node', 'nodes'], ['nodes', 'nodes'],
    ['sts', 'statefulsets'], ['statefulset', 'statefulsets'], ['statefulsets', 'statefulsets'],
    ['ns', 'namespaces'], ['namespace', 'namespaces'], ['namespaces', 'namespaces'],
])

async function processKubectlCommand(config, cmdArray, logCtx) {
    cmdArray = cmdArray.filter(cmd => cmd.toString().trim() !== '')
    const kc = new k8s.KubeConfig()
    kc.loadFromString(config)
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
    const k8sAppApi = kc.makeApiClient(k8s.AppsV1Api)
    const metricsApi = new k8s.Metrics(kc)

    if (cmdArray.length < 2) {
        return cmdConstant.RESULT_CMD_PARAMS_ERROR
    }

    const cmdParams = {
        operator: cmdArray[0],
        ns: 'default',
    }

    if (cmdParams.operator !== 'run') {
        cmdParams.resource = resourceMap.get(cmdArray[1]) || cmdArray[1]
    }

    const paramRules = {
        '-n': {target: 'ns', required: true},
        '-o': {target: 'format', required: true},
    }

    for (let i = cmdParams.operator !== 'run' ? 2 : 1; i < cmdArray.length; i++) {
        const cmd = cmdArray[i]
        if (paramRules[cmd]) {
            const rule = paramRules[cmd]
            if (cmdArray.length < i + 2) {
                return cmdConstant.RESULT_CMD_PARAMS_ERROR
            }
            cmdParams[rule.target] = cmdArray[i + 1]
            i++
        } else if (cmd.startsWith('--')) {
            const kv = cmd.split('=')
            if (kv.length !== 2) {
                // 无效的参数
                return cmdConstant.RESULT_CMD_PARAMS_ERROR
            }
            switch (kv[0]) {
                case '--image':
                    cmdParams.image = kv[1]
                    break
                case '--expose':
                    cmdParams.expose = kv[1]
                    break
                case '--port':
                    cmdParams.port = kv[1]
                    break
                case '--target-port':
                    cmdParams.targetPort = kv[1]
                    break
                case '--node-port':
                    cmdParams.nodePort = kv[1]
                    break
                case '--type':
                    cmdParams.type = kv[1]
                    break
                case '--name':
                    cmdParams.innerName = kv[1]
                    break
                default:
                    return cmdConstant.RESULT_CMD_PARAMS_ERROR
            }
        } else {
            if (cmdParams.name) {
                return cmdConstant.RESULT_CMD_PARAMS_ERROR
            }
            cmdParams.name = cmd
        }
    }

    try {
        switch (cmdParams.operator) {
            case 'get':
                return formatGetResourceOutput(cmdParams.resource, await handleGetCommand(k8sApi, k8sAppApi, cmdParams))
            case 'top':
                return await handleTopCommand(metricsApi, cmdParams)
            case 'run':
                return await handleRunCommand(k8sApi, cmdParams)
            case 'expose':
                return await handleExposeCommand(k8sApi, cmdParams)
            case 'delete':
                return await handleDeleteCommand(k8sApi, cmdParams)
            case 'create':
                return await handleCreateCommand(k8sApi, cmdParams)
            default:
                return cmdConstant.RESULT_NO_SUCH_CMD
        }
    } catch (error) {
        logCtx.e('processKubectlCommand', error.message)
        return cmdConstant.RESULT_CMD_PARAMS_ERROR
    }
}

async function handleGetCommand(k8sApi, k8sAppApi, cmdParams) {
    let list
    switch (cmdParams.resource) {
        case 'pods':
            list = await k8sApi.listNamespacedPod({namespace: cmdParams.ns})
            return list.items.map(item => {
                const res = {
                    name: item.metadata.name,
                    ready: item.status.containerStatuses ? `${item.status.containerStatuses.filter(i => i.ready).length}/${item.status.containerStatuses.length}` : '0/1',
                    status: item.status.phase,
                    restart: item.status.containerStatuses?.reduce((sum, i) => sum + i.restartCount, 0) || 0,
                }
                if (cmdParams.format === 'wide') {
                    res.ip = item.status.podIP
                    res.node = item.spec.nodeName
                }
                return res
            }).filter(item => !cmdParams.name || item.name === cmdParams.name)
        case 'services':
            list = await k8sApi.listNamespacedService({namespace: cmdParams.ns})
            return list.items.map(item => {
                const res = {
                    name: item.metadata.name,
                    type: item.spec.type,
                    clusterIp: item.spec.clusterIP,
                    ports: item.spec.ports.map(p => `${p.port}${p.nodePort ? ':' + p.nodePort : ''}/${p.protocol}`).join(','),
                }
                if (cmdParams.format === 'wide') {
                    res.selector = item.spec.selector ? Object.entries(item.spec.selector).map(([k, v]) => `${k}=${v}`).join(',') : '<none>'
                }
                return res
            }).filter(item => !cmdParams.name || item.name === cmdParams.name)
        case 'deployments':
            list = await k8sAppApi.listNamespacedDeployment({namespace: cmdParams.ns})
            return list.items.map(item => {
                const res = {
                    name: item.metadata.name,
                    ready: `${item.status.readyReplicas}/${item.status.replicas}`,
                    upToDate: item.status.updatedReplicas,
                    available: item.status.availableReplicas,
                }
                if (cmdParams.format === 'wide') {
                    res.images = item.spec.template.spec.containers.map(i => i.image).join(',')
                    res.containers = item.spec.template.spec.containers.map(i => i.name).join(',')
                }
                return res
            }).filter(item => !cmdParams.name || item.name === cmdParams.name)
        case 'statefulsets':
            list = await k8sAppApi.listNamespacedStatefulSet({namespace: cmdParams.ns})
            return list.items.map(item => {
                const res = {
                    name: item.metadata.name,
                    ready: `${item.status.readyReplicas}/${item.status.replicas}`,
                }
                if (cmdParams.format === 'wide') {
                    res.containers = item.spec.template.spec.containers.map(i => i.name).join(',')
                    res.images = item.spec.template.spec.containers.map(i => i.image).join(',')
                }
                return res
            }).filter(item => !cmdParams.name || item.name === cmdParams.name)
        case 'namespaces':
            list = await k8sApi.listNamespace()
            return list.items.map(item => ({
                name: item.metadata.name,
                status: item.status.phase
            })).filter(item => !cmdParams.name || item.name === cmdParams.name)
        case 'nodes':
            list = await k8sApi.listNode()
            return list.items.map(item => {
                const res = {
                    name: item.metadata.name,
                    status: item.status.conditions.filter(i => i.status === 'True').map(i => i.type).join(','),
                    roles: Object.keys(item.metadata.labels).filter(item => item.startsWith('node-role.kubernetes.io')).map(i => i.split('/')[1]).join(','),
                    version: item.status.nodeInfo.kubeletVersion,
                }
                if (cmdParams.format === 'wide') {
                    res.internalIp = item.status.addresses.filter(i => i.type === 'InternalIP').map(i => i.address).join(',')
                    res.osImage = item.status.nodeInfo.osImage
                    res.kernelVersion = item.status.nodeInfo.kernelVersion
                    res.containerRuntime = item.status.nodeInfo.containerRuntimeVersion
                }
                return res
            }).filter(item => !cmdParams.name || item.name === cmdParams.name)
        default:
            return []
    }
}

function formatGetResourceOutput(resourceName, resourceList) {
    const output = [`${resourceName}信息:`]
    for (const resource of resourceList) {
        output.push(`  NAME: ${resource.name}`)
        for (const [key, value] of Object.entries(resource)) {
            if (key !== 'name') {
                output.push(`    ${key.toUpperCase()}: ${value}`)
            }
        }
    }
    return output.join('\n')
}

async function handleTopCommand(metricsApi, cmdParams) {
    let resultStr = []
    switch (cmdParams.resource) {
        case 'pods':
            const podsMetrics = await metricsApi.getPodMetrics(cmdParams.ns)
            const targetPod = podsMetrics.items.filter(i => !cmdParams.name || i.metadata.name === cmdParams.name)
            resultStr = ['Pods资源占用信息:']
            for (const pod of targetPod) {
                resultStr.push(`  Pod Name: ${pod.metadata.name}`)
                for (const container of pod.containers) {
                    resultStr.push(`    Container Name: ${container.name}`)
                    resultStr.push(`      Container CPU Usage: ${ncToMc(container.usage.cpu)}`)
                    resultStr.push(`      Container Memory Usage: ${kiToMiOrGi(container.usage.memory)}`)
                }
            }
            return resultStr.join('\n')
        case 'nodes':
            const nodeMetrics = await metricsApi.getNodeMetrics()
            const targetNode = nodeMetrics.items.filter(i => !cmdParams.name || i.metadata.name === cmdParams.name)
            resultStr = ['Nodes资源占用信息:']
            for (const node of targetNode) {
                resultStr.push(`  Node Name: ${node.metadata.name}`)
                resultStr.push(`    Node CPU Usage: ${ncToMc(node.usage.cpu)}`)
                resultStr.push(`    Node Memory Usage: ${kiToMiOrGi(node.usage.memory)}`)
            }
            return resultStr.join('\n')
        default:
            return cmdConstant.RESULT_NO_SUCH_CMD
    }
}

function ncToMc(ncStr) {
    const nc = parseInt(ncStr.replace('n', ''))
    if (isNaN(nc)) {
        return ncStr
    }
    const millicores = Math.floor(nc / 1000000)
    const nanocores = nc % 1000000
    return millicores === 0 ? `${nanocores}n` : `${millicores}m${nanocores}n`
}

function kiToMiOrGi(kbStr) {
    const kb = parseInt(kbStr.replace('Ki', ''))
    if (isNaN(kb)) {
        return kbStr
    }
    const mb = Math.floor(kb / 1024)
    const remainingKb = kb % 1024
    if (mb < 1024) {
        if (mb === 0) {
            return `${remainingKb}Ki`
        } else {
            return `${mb}Mi${remainingKb}Ki`
        }
    } else {
        const gb = Math.floor(mb / 1024)
        const remainingMb = mb % 1024
        return `${gb}Gi${remainingMb}Mi${remainingKb}Ki`
    }
}

async function handleRunCommand(k8sApi, cmdParams) {
    // 检查参数
    if (!cmdParams.name || !cmdParams.image) {
        return cmdConstant.RESULT_CMD_PARAMS_ERROR
    }

    const pod = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
            name: cmdParams.name,
            namespace: cmdParams.ns,
            labels: {
                run: cmdParams.name
            }
        },
        spec: {
            containers: [
                {
                    name: cmdParams.name,
                    image: cmdParams.image,
                    imagePullPolicy: 'IfNotPresent'
                }
            ]
        }
    }

    let createSuccess = false
    let podCreateResult

    try {
        podCreateResult = await k8sApi.createNamespacedPod({namespace: pod.metadata.namespace, body: pod})
        createSuccess = true
    } catch (err) {
        return err.body
    }

    if (createSuccess) {
        if (cmdParams.expose === 'true' && cmdParams.port) {
            // 暴露ClusterIP类型的Service
            const svc = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: {
                    name: cmdParams.name,
                    namespace: cmdParams.ns
                },
                spec: {
                    selector: {
                        run: cmdParams.name
                    },
                    ports: [
                        {
                            protocol: 'TCP',
                            port: parseInt(cmdParams.port),
                            targetPort: parseInt(cmdParams.targetPort)
                        }
                    ],
                    type: 'ClusterIP'
                }
            }
            try {
                let svcCreateResult = await k8sApi.createNamespacedService({
                    namespace: svc.metadata.namespace,
                    body: svc
                })
                return 'Pod Create Success, name: ' + podCreateResult.metadata.name + '\n' + 'Service Create Success, name: ' + svcCreateResult.metadata.name
            } catch (err) {
                return 'Pod Create Success, name: ' + podCreateResult.metadata.name + '\n' + err.body
            }
        } else {
            return 'Pod Create Success, name: ' + podCreateResult.metadata.name
        }
    } else {
        return JSON.stringify(podCreateResult)
    }
}

async function handleExposeCommand(k8sApi, cmdParams) {
    if (!cmdParams.name || !cmdParams.port) {
        return cmdConstant.RESULT_CMD_PARAMS_ERROR
    }
    if (!cmdParams.targetPort) {
        cmdParams.targetPort = cmdParams.port
    }
    if (!cmdParams.innerName) {
        cmdParams.innerName = cmdParams.name
    }
    switch (cmdParams.resource) {
        case 'pods':
            const svc = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: {
                    name: cmdParams.innerName,
                    namespace: cmdParams.ns
                },
                spec: {
                    selector: {
                        run: cmdParams.name
                    },
                    ports: [
                        {
                            protocol: 'TCP',
                            port: parseInt(cmdParams.port),
                            targetPort: parseInt(cmdParams.targetPort)
                        }
                    ],
                    type: 'ClusterIP'
                }
            }
            if (cmdParams.type) {
                svc.spec.type = cmdParams.type
            }
            if (cmdParams.nodePort && svc.spec.type === 'NodePort') {
                svc.spec.ports[0].nodePort = parseInt(cmdParams.nodePort)
            }
            try {
                const svcCreateResult = await k8sApi.createNamespacedService({namespace: svc.metadata.namespace, body: svc})
                return 'Service Create Success, name: ' + svcCreateResult.metadata.name
            } catch (err) {
                return err.body
            }
        default:
            return 'expose only support pod resource.'
    }
}

async function handleDeleteCommand(k8sApi, cmdParams) {
    if (!cmdParams.name) {
        return cmdConstant.RESULT_CMD_PARAMS_ERROR
    }
    switch (cmdParams.resource) {
        case 'pods':
            try {
                const deletePodResult = await k8sApi.deleteNamespacedPod({
                    name: cmdParams.name,
                    namespace: cmdParams.ns
                })
                return 'Delete Pod Success, name: ' + deletePodResult.metadata.name
            } catch (err) {
                return err.message
            }
        case 'services':
            try {
                const deleteSvcResult = await k8sApi.deleteNamespacedService({
                    name: cmdParams.name,
                    namespace: cmdParams.ns
                })
                return 'Delete Service Success, name: ' + deleteSvcResult.metadata.name
            } catch (err) {
                return err.message
            }
        case 'namespaces':
            try {
                await k8sApi.deleteNamespace({
                    name: cmdParams.name
                })
                return 'Request Delete Namespace Task Success.'
            } catch (err) {
                return err.message
            }
        default:
            return 'delete only support pod or service or namespaces resource'
    }
}

async function handleCreateCommand(k8sApi, cmdParams) {
    if (!cmdParams.name) {
        return cmdConstant.RESULT_CMD_PARAMS_ERROR
    }
    switch (cmdParams.resource) {
        case 'namespaces':
            const namespace = {
                apiVersion: 'v1',
                kind: 'Namespace',
                metadata: {
                    name: cmdParams.name
                }
            }
            try {
                const createNamespaceResult = await k8sApi.createNamespace({
                    body: namespace
                })
                return 'Create Namespace Success, name: ' + createNamespaceResult.metadata.name
            } catch (err) {
                return err.message
            }
            default:
                return 'create only support namespaces resources.'
    }
}

export default {
    'help': async function () {
        return await new Promise((resolve, reject) => {
            fs.readFile('src/help', 'utf8', (err, data) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(data)
                }
            })
        })
    },
    'other': async function (config, cmdArray, logCtx) {
        return await processKubectlCommand(config, cmdArray, logCtx)
    }
}