/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Optional Node-only deps pulled in transitively by @metamask/sdk,
    // @walletconnect/*, pino, etc. Marking them as externals prevents
    // "Module not found" warnings in the browser bundle.
    config.externals.push(
      "pino-pretty",
      "lokijs",
      "encoding",
      "bufferutil",
      "utf-8-validate"
    );

    // @metamask/sdk imports React Native modules; the browser bundle never
    // executes those code paths, but webpack still tries to resolve them.
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native": false,
      "react-native-webview": false,
      "@react-native-async-storage/async-storage": false,
    };

    // Node built-ins referenced by some wallet SDKs — always absent in browser.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
