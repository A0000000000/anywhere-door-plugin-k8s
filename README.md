# anywhere-door-plugin-k8s
AnywhereDoor Plugin Kubernetes实现

## 环境变量
* HOST: 控制平面地址
* PORT: 控制平面端口
* PREFIX: 控制平面前缀
* USERNAME: plugin所属用户名称
* TOKEN: plugin令牌
* PLUGIN_NAME: plugin名称

## 打包方式
1. 将代码clone下来
2. 安装docker及buildx
3. 打包镜像
    * `docker buildx build --platform linux/amd64 -t 192.168.25.5:31100/maoyanluo/anywhere-door-plugin-k8s:1.0 . --load`

## 部署方式

### Docker Command Line
1. 运行容器
    * `docker run --name anywhere-door-plugin-k8s -itd -p 8086:80 -e HOST=ip -e PORT=port -e USERNAME=username -e TOKEN=token -e PLUGIN_NAME=kubebot --restart=always 192.168.25.5:31100/maoyanluo/anywhere-door-plugin-k8s:1.0`

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: anywhere-door-plugin-k8s-deployment
  namespace: anywhere-door
spec:
  replicas: 1
  selector:
    matchLabels:
      app: anywhere-door-plugin-k8s
  template:
    metadata:
      labels:
        app: anywhere-door-plugin-k8s
    spec:
      containers:
      - name: anywhere-door-plugin-k8s
        image: 192.168.25.5:31100/maoyanluo/anywhere-door-plugin-k8s:1.0
        imagePullPolicy: IfNotPresent
        env:
        - name: HOST
          value: "anywhere-door-control-plane-service.anywhere-door"
        - name: PORT
          value: "80"
        - name: USERNAME
          value: username
        - name: TOKEN
          value: token
        - name: PLUGIN_NAME
          value: "kubebot"
        ports:
        - containerPort: 80
      restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  name: anywhere-door-plugin-k8s-service
  namespace: anywhere-door
  labels:
    app: anywhere-door-plugin-k8s
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: anywhere-door-plugin-k8s
```

## 使用方式
### 配置获取
* 将config中的ip地址替换成k8s集群ip, 然后将配置注册进AnywhereDoor
![config](config.png)
### 注册插件
1. 运行容器
2. 注册plugin: POST AnywhereDoorManager/plugin/create & Header: token: token & Body: { "plugin_name": "name", "plugin_describe": "desc", "plugin_host": "anywhere-door-plugin-k8s-service.anywhere-door", "plugin_port": 80, "plugin_token": "token" }
3. 增加plugin配置: POST AnywhereDoorManager/config/create & Header: token: token & Body: key: kubeconfig, value: 来自k8s集群配置文件内容