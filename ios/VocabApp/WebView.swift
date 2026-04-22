import SwiftUI
import WebKit
import AudioToolbox
import UIKit

class HapticBridge: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let style = message.body as? String else { return }
        switch style {
        case "light":
            let gen = UIImpactFeedbackGenerator(style: .light)
            gen.impactOccurred()
        case "medium":
            let gen = UIImpactFeedbackGenerator(style: .medium)
            gen.impactOccurred()
        case "heavy":
            let gen = UIImpactFeedbackGenerator(style: .heavy)
            gen.impactOccurred()
        case "success":
            let gen = UINotificationFeedbackGenerator()
            gen.notificationOccurred(.success)
        case "warning":
            let gen = UINotificationFeedbackGenerator()
            gen.notificationOccurred(.warning)
        case "error":
            let gen = UINotificationFeedbackGenerator()
            gen.notificationOccurred(.error)
        default:
            let gen = UIImpactFeedbackGenerator(style: .light)
            gen.impactOccurred()
        }
    }
}

struct WebViewContainer: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.javaScriptEnabled = true
        
        // 允许内联媒体播放
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        // 注册触感反馈 bridge
        let bridge = HapticBridge()
        config.userContentController.add(bridge, name: "haptic")
        
        // 注入 safe area insets，解决 WKWebView 中 env() 可能不生效的问题
        let safeAreaJS = """
        (function() {
            function applySafeArea() {
                if (window._safeTop !== undefined) {
                    document.documentElement.style.setProperty('--safe-top', window._safeTop + 'px');
                }
                if (window._safeBottom !== undefined) {
                    document.documentElement.style.setProperty('--safe-bottom', window._safeBottom + 'px');
                }
            }
            window.addEventListener('_safeAreaUpdated', applySafeArea);
        })();
        """
        let safeAreaScript = WKUserScript(source: safeAreaJS, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        config.userContentController.addUserScript(safeAreaScript)
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .white
        webView.navigationDelegate = context.coordinator
        
        // 加载本地 web 文件
        if let bundlePath = Bundle.main.bundlePath {
            let htmlPath = bundlePath + "/web/index.html"
            let htmlUrl = URL(fileURLWithPath: htmlPath)
            let directory = URL(fileURLWithPath: bundlePath)
            webView.loadFileURL(htmlUrl, allowingReadAccessTo: directory)
        }
        
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        // 在布局完成后注入 safe area insets
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            if let window = webView.window {
                let safeTop = window.safeAreaInsets.top
                let safeBottom = window.safeAreaInsets.bottom
                let js = "window._safeTop = \(safeTop); window._safeBottom = \(safeBottom); document.documentElement.dispatchEvent(new Event('_safeAreaUpdated'));"
                webView.evaluateJavaScript(js)
            }
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // 页面加载完成后注入 safe area
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                if let window = webView.window {
                    let safeTop = window.safeAreaInsets.top
                    let safeBottom = window.safeAreaInsets.bottom
                    let js = "window._safeTop = \(safeTop); window._safeBottom = \(safeBottom); document.documentElement.dispatchEvent(new Event('_safeAreaUpdated'));"
                    webView.evaluateJavaScript(js)
                }
            }
        }
    }
}

#Preview {
    WebViewContainer()
}
