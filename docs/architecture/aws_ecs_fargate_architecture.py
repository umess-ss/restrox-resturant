from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import Fargate, ECS, ECR
from diagrams.aws.network import ALB
from diagrams.aws.management import Cloudwatch, SystemsManager
from diagrams.aws.security import ACM
from diagrams.generic.device import Mobile
from diagrams.generic.network import Router
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.database import Mongodb
from diagrams.onprem.client import Users

# ============== IMPROVED SETTINGS FOR BETTER READABILITY ==============
graph_attr = {
    "fontsize": "18",
    "bgcolor": "white",
    "pad": "1.2",
    "splines": "polyline",
    "nodesep": "1.3",
    "ranksep": "1.5",
}

node_attr = {
    "fontsize": "16",      # Balanced size
    "width": "1",        # Wider nodes
    "height": "1",       # Taller nodes
    "margin": "2",
}

edge_attr = {
    "fontsize": "10",
}

with Diagram(
    name="Full-Stack MERN Deployment on AWS ECS Fargate",
    filename="docs/architecture/aws_fargate_production_architecture",
    show=False,
    direction="LR",
    outformat="png",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):

    # Left Side
    users = Users("Users / Browser")
    cloudflare = Router("Cloudflare DNS\napi.umeshrajbanshi.com.np\nCNAME → ALB")

    github = GithubActions("GitHub Actions\nCI/CD Pipeline")

    with Cluster("AWS Cloud - us-east-1"):
        acm = ACM("AWS Certificate Manager\nTLS Certificate")
        ecr = ECR("Amazon ECR\nrestrox-backend")
        cloudwatch = Cloudwatch("CloudWatch Logs")
        ssm = SystemsManager("SSM Parameter Store\nMONGO_URI\nJWT_SECRET\nJWT_REFRESH_SECRET")

        with Cluster("VPC - Default VPC"):
            with Cluster("Availability Zone A"):
                with Cluster("Public Subnet"):
                    alb = ALB("Application Load Balancer\nHTTPS :443\nHTTP → HTTPS Redirect")

                with Cluster("ECS Fargate Service"):
                    service = Fargate("restrox-backend-service\nDesired Tasks: 1")
                    app_container = ECS(
                        "Node.js + Express\n"
                        "Port: 5000\n\n"
                        "Full-Stack MERN\n"
                        "(React + API)"
                    )

            with Cluster("Availability Zone B"):
                pass  # High Availability

        mongodb = Mongodb("MongoDB Atlas\nRestaurant Database\nTLS Connection")

    # Connections
    users >> Edge(label="Request") >> cloudflare
    cloudflare >> Edge(label="HTTPS", color="blue") >> alb
    acm >> Edge(label="TLS Cert", style="dashed") >> alb

    alb >> Edge(label="Forward\nPort 5000") >> service
    service >> app_container

    # CI/CD
    github >> Edge(label="Build & Push", style="dashed") >> ecr
    ecr >> Edge(label="Pull Image", style="dashed") >> service

    # Backend Connections
    ssm >> Edge(label="Secrets", style="dashed", color="red") >> app_container
    app_container >> Edge(label="Logs") >> cloudwatch
    app_container >> Edge(label="MONGO_URI (TLS)", color="green") >> mongodb

print("✅ Improved Diagram Generated!")
print("Saved as: docs/architecture/aws_fargate_production_architecture.png")