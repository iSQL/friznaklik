# --- Configuration ---
$DockerHubUsername = "maremilojkovic" # Your Docker Hub username
$ImageName = "friznaklik"             # Your image name
$DockerfilePath = "./Dockerfile"       # Path to your Dockerfile (assuming it's in the current directory)
$BuildContextPath = "."              # Docker build context path (usually current directory)

# Generate a unique tag (e.g., based on timestamp)
$TimestampTag = Get-Date -Format "yyyyMMddHHmmss"
$FullImageNameWithTimestamp = "$DockerHubUsername/$ImageName`:$TimestampTag"
$FullImageNameLatest = "$DockerHubUsername/$ImageName`:latest"

# Build Arguments (Set these values as needed)
# For sensitive keys, consider using environment variables or prompting the user
$Env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_BUILD_ARG = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx" # Replace with your actual key
$Env:NEXT_PUBLIC_CLERK_DOMAIN_BUILD_ARG = "your-instance-name.clerk.accounts.dev"      # Replace with your actual domain
$Env:NEXT_PUBLIC_SITE_URL_BUILD_ARG = "http://localhost:3000"                     # Replace with your actual site URL for the build if necessary

# --- Script Start ---
Write-Host "Starting Docker image build and push process..."
Write-Host "-----------------------------------------------"

# 1. Docker Login (Optional - run manually or ensure you're already logged in)
# You might be prompted for your password if you uncomment and run this.
# Alternatively, log in manually: docker login -u $DockerHubUsername
# Write-Host "Attempting Docker Hub login for user '$DockerHubUsername'..."
# docker login -u $DockerHubUsername
# if ($LASTEXITCODE -ne 0) {
#     Write-Error "Docker login failed. Please log in manually and try again."
#     exit 1
# }
# Write-Host "Docker login successful."

# 2. Build the Docker Image
Write-Host "Building Docker image: $FullImageNameWithTimestamp (and tagging as latest)..."
$BuildArgs = "--build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$($Env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_BUILD_ARG) " +
             "--build-arg NEXT_PUBLIC_CLERK_DOMAIN=$($Env:NEXT_PUBLIC_CLERK_DOMAIN_BUILD_ARG) " +
             "--build-arg NEXT_PUBLIC_SITE_URL=$($Env:NEXT_PUBLIC_SITE_URL_BUILD_ARG)"

# The -t flag can be used multiple times to apply multiple tags at build time.
docker build -t $FullImageNameWithTimestamp -t $FullImageNameLatest -f $DockerfilePath $BuildArgs $BuildContextPath

if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed."
    exit 1
}
Write-Host "Docker image built successfully and tagged as '$FullImageNameWithTimestamp' and '$FullImageNameLatest'."

# 3. Push the Docker Image (Timestamp Tag)
Write-Host "Pushing image '$FullImageNameWithTimestamp' to Docker Hub..."
docker push $FullImageNameWithTimestamp

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push image '$FullImageNameWithTimestamp' to Docker Hub."
    exit 1
}
Write-Host "Image '$FullImageNameWithTimestamp' pushed successfully."

# 4. Push the Docker Image (Latest Tag)
Write-Host "Pushing image '$FullImageNameLatest' to Docker Hub..."
docker push $FullImageNameLatest

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push image '$FullImageNameLatest' to Docker Hub."
    exit 1
}
Write-Host "Image '$FullImageNameLatest' pushed successfully."

Write-Host "-----------------------------------------------"
Write-Host "Docker image build and push process completed."