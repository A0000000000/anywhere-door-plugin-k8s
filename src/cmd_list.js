import fs from 'fs'
import cmdConstant from './cmd_constant.js'
import * as k8s from "@kubernetes/client-node"

function convertResource(resource) {
    if (resource === 'po' || resource === 'pod' || resource === 'pods') {
        return 'pods'
    }
    if (resource === 'deploy' || resource === 'deployment' || resource === 'deployments') {
        return 'deployments'
    }
    if (resource === 'svc' || resource === 'service' || resource === 'services') {
        return 'services'
    }
    if (resource === 'no' || resource === 'node' || resource === 'nodes') {
        return 'nodes'
    }
    if (resource === 'sts' || resource === 'statefulset' || resource === 'statefulsets') {
        return 'statefulsets'
    }
    if (resource === 'ns' || resource === 'namespace' || resource === 'namespaces') {
        return 'namespaces'
    }
    return resource
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
    'other': async function (config, cmds) {
        cmds = cmds.filter(cmd => cmd.toString().trim() !== '')
        const kc = new k8s.KubeConfig()
        kc.loadFromString(config)
        const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
        const k8sAppApi = kc.makeApiClient(k8s.AppsV1Api)
        // 计划cmds传递类似kubectl后面的参数
        // 不支持交互式的指令, 比如 kubectl edit
        if (cmds.length < 2) {
            return cmdConstant.RESULT_CMD_PARAMS_ERROR
        }
        const cmdParams = {
            'operator': cmds[0],
            'resource': convertResource(cmds[1])
        }
        for (let i = 2; i < cmds.length; i++) {
            if (cmds[i] === '-n') {
                if (cmds.length < i + 2) {
                    return cmdConstant.RESULT_CMD_PARAMS_ERROR
                } else {
                    cmdParams['ns'] = cmds[i + 1]
                    i++
                }
            } else if (cmds[i] === '-o') {
                if (cmds.length < i + 2) {
                    return cmdConstant.RESULT_CMD_PARAMS_ERROR
                } else {
                    cmdParams['format'] = cmds[i + 1]
                    i++
                }
            } else {
                if (cmdParams.hasOwnProperty('name')) {
                    return cmdConstant.RESULT_CMD_PARAMS_ERROR
                }
                cmdParams['name'] = cmds[i]
            }
        }
        switch (cmdParams['resource']) {
            case 'pods':
                switch (cmdParams['operator']) {
                    case 'get':
                        let podList = []
                        if (cmdParams.hasOwnProperty('ns')) {
                            podList = await k8sApi.listNamespacedPod({
                                namespace: cmdParams.ns
                            })
                        } else {
                            podList = await k8sApi.listPodForAllNamespaces()
                        }
                        const pods = podList.items.map(item => {
                            const res = {
                                name: item.metadata.name,
                                ready: `${item.status.containerStatuses.filter(i => i.ready === true).length}/${item.status.containerStatuses.length}`,
                                status: item.status.phase,
                                restart: item.status.containerStatuses.reduce((sum, i) => sum + i.restartCount, 0)
                            }
                            if (cmdParams.hasOwnProperty('format') && cmdParams.format === 'wide') {
                                res.ip = item.status.podIP
                                res.node = item.spec.nodeName
                            }
                            if (!cmdParams.hasOwnProperty('ns')) {
                                res.namespace = item.metadata.namespace
                            }
                            return res
                        }).filter(item => cmdParams.hasOwnProperty('name') ? item.name === cmdParams.name : true)
                        let podsRes = 'Pods信息:'
                        for (const i in pods) {
                            const pod = pods[i]
                            podsRes += `\n  NAME: ${pod.name}`
                            Object.keys(pod).forEach(key => {
                                if (key === 'name') {
                                    return
                                }
                                podsRes += `\n    ${key.toUpperCase()}: ${pod[key]}`
                            })
                        }
                        return podsRes
                    default:
                        return cmdConstant.RESULT_NO_SUCH_CMD
                }
            case 'services':
                switch (cmdParams['operator']) {
                    case 'get':
                        let serviceList = []
                        if (cmdParams.hasOwnProperty('ns')) {
                            serviceList = await k8sApi.listNamespacedService({
                                namespace: cmdParams.ns
                            })
                        } else {
                            serviceList = await k8sApi.listServiceForAllNamespaces()
                        }
                        const svcs = serviceList.items.map(item => {
                            const res = {
                                name: item.metadata.name,
                                type: item.spec.type,
                                clusterIp: item.spec.clusterIP,
                                ports: item.spec.ports.map(p => `${p.port}${(!!p.nodePort) ? ':' + p.nodePort : ''}/${p.protocol}`).join(',')
                            }
                            if (cmdParams.hasOwnProperty('format') && cmdParams.format === 'wide') {
                                res.selector = (!!item.spec.selector) ? Object.keys(item.spec.selector).map(i => `${i}=${item.spec.selector[i]}`).join(',') : '<none>'
                            }
                            if (!cmdParams.hasOwnProperty('ns')) {
                                res.namespace = item.metadata.namespace
                            }
                            return res
                        }).filter(item => cmdParams.hasOwnProperty('name') ? item.name === cmdParams.name : true)
                        let svcsRes = 'Services信息:'
                        for (const i in svcs) {
                            const svc = svcs[i]
                            svcsRes += `\n  NAME: ${svc.name}`
                            Object.keys(svc).forEach(key => {
                                if (key === 'name') {
                                    return
                                }
                                svcsRes += `\n    ${key.toUpperCase()}: ${svc[key]}`
                            })
                        }
                        return svcsRes
                    default:
                        return cmdConstant.RESULT_NO_SUCH_CMD
                }
            case 'deployments':
                switch (cmdParams['operator']) {
                    case 'get':
                        let deployList = []
                        if (cmdParams.hasOwnProperty('ns')) {
                            deployList = await k8sAppApi.listNamespacedDeployment({
                                namespace: cmdParams.ns
                            })
                        } else {
                            deployList = await k8sAppApi.listDeploymentForAllNamespaces()
                        }
                        const deploys = deployList.items.map(item => {
                            const res = {
                                name: item.metadata.name,
                                ready: `${item.status.readyReplicas}/${item.status.replicas}`,
                                upToDate: item.status.updatedReplicas,
                                available: item.status.availableReplicas
                            }
                            if (cmdParams.hasOwnProperty('format') && cmdParams.format === 'wide') {
                                res.containers = item.spec.template.spec.containers.map(item => item.name).join(',')
                                res.images = item.spec.template.spec.containers.map(item => item.image).join(',')
                            }
                            if (!cmdParams.hasOwnProperty('ns')) {
                                res.namespace = item.metadata.namespace
                            }
                            return res
                        }).filter(item => cmdParams.hasOwnProperty('name') ? item.name === cmdParams.name : true)
                        let deploysRes = 'Deployments信息:'
                        for (const i in deploys) {
                            const deploy = deploys[i]
                            deploysRes += `\n  NAME: ${deploy.name}`
                            Object.keys(deploy).forEach(key => {
                                if (key === 'name') {
                                    return
                                }
                                deploysRes += `\n    ${key.toUpperCase()}: ${deploy[key]}`
                            })
                        }
                        return deploysRes
                    default:
                        return cmdConstant.RESULT_NO_SUCH_CMD
                }
            case 'statefulsets':
                switch (cmdParams['operator']) {
                    case 'get':
                        let stsList = []
                        if (cmdParams.hasOwnProperty('ns')) {
                            stsList = await k8sAppApi.listNamespacedStatefulSet({
                                namespace: cmdParams.ns
                            })
                        } else {
                            stsList = await k8sAppApi.listStatefulSetForAllNamespaces()
                        }
                        const sts = stsList.items.map(item => {
                            const res = {
                                name: item.metadata.name,
                                ready: `${item.status.readyReplicas}/${item.status.replicas}`
                            }
                            if (cmdParams.hasOwnProperty('format') && cmdParams.format === 'wide') {
                                res.containers = item.spec.template.spec.containers.map(item => item.name).join(',')
                                res.images = item.spec.template.spec.containers.map(item => item.image).join(',')
                            }
                            if (!cmdParams.hasOwnProperty('ns')) {
                                res.namespace = item.metadata.namespace
                            }
                            return res
                        }).filter(item => cmdParams.hasOwnProperty('name') ? item.name === cmdParams.name : true)
                        let stsRes = 'StatefulSets信息:'
                        for (const i in sts) {
                            const st = sts[i]
                            stsRes += `\n  NAME: ${st.name}`
                            Object.keys(st).forEach(key => {
                                if (key === 'name') {
                                    return
                                }
                                stsRes += `\n    ${key.toUpperCase()}: ${st[key]}`
                            })
                        }
                        return stsRes
                    default:
                        return cmdConstant.RESULT_NO_SUCH_CMD
                }
            case 'namespaces':
                switch (cmdParams['operator']) {
                    case 'get':
                        const namespaces = await k8sApi.listNamespace()
                        const nsList = namespaces.items.map(item => {
                            const res = {
                                name: item.metadata.name,
                                status: item.status.phase
                            }
                            return res
                        }).filter(item => cmdParams.hasOwnProperty('name') ? item.name === cmdParams.name : true)
                        let nsRes = 'Namespaces信息:'
                        for (const i in nsList) {
                            const ns = nsList[i]
                            nsRes += `\n  NAME: ${ns.name}`
                            Object.keys(ns).forEach(key => {
                                if (key === 'name') {
                                    return
                                }
                                nsRes += `\n    ${key.toUpperCase()}: ${ns[key]}`
                            })
                        }
                        return nsRes
                    default:
                        return cmdConstant.RESULT_NO_SUCH_CMD
                }
            case 'nodes':
                switch (cmdParams['operator']) {
                    case 'get':
                        const nodes = await k8sApi.listNode()
                        const nodeList = nodes.items.map(item => {
                            const res = {
                                name: item.metadata.name,
                                status: item.status.conditions.filter(i => i.status === 'True').map(i => i.type).join(','),
                                roles: Object.keys(item.metadata.labels).filter(item => item.startsWith('node-role.kubernetes.io')).map(i => i.split('/')[1]).join(','),
                                version: item.status.nodeInfo.kubeletVersion
                            }
                            if (cmdParams.hasOwnProperty('format') && cmdParams.format === 'wide') {
                                res.internalIp = item.status.addresses.filter(i => i.type === 'InternalIP').map(i => i.address).join(',')
                                res.osImage = item.status.nodeInfo.osImage
                                res.kernelVersion = item.status.nodeInfo.kernelVersion
                                res.containerRuntime = item.status.nodeInfo.containerRuntimeVersion
                            }
                            return res
                        }).filter(item => cmdParams.hasOwnProperty('name') ? item.name === cmdParams.name : true)
                        let nodeRes = 'Nodes信息:'
                        for (const i in nodeList) {
                            const node = nodeList[i]
                            nodeRes += `\n  NAME: ${node.name}`
                            Object.keys(node).forEach(key => {
                                if (key === 'name') {
                                    return
                                }
                                nodeRes += `\n    ${key.toUpperCase()}: ${node[key]}`
                            })
                        }
                        return nodeRes
                    default:
                        return cmdConstant.RESULT_NO_SUCH_CMD
                }
            default:
                return cmdConstant.RESULT_CMD_PARAMS_ERROR
        }

    }
}
