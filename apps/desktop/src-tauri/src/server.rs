use axum::{
    http::{HeaderMap, StatusCode, Uri},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use std::collections::HashMap;
use tower_http::cors::CorsLayer;

// ── Embedded Frontend Files ───────────────────────────────────

static INDEX_HTML: &[u8] = include_bytes!("C:\\Users\\preet\\Documents\\projects\\personal-translator\\apps\\desktop\\dist\\index.html");
static CSS: &[u8] = include_bytes!("C:\\Users\\preet\\Documents\\projects\\personal-translator\\apps\\desktop\\dist\\assets\\index-CEktmZl2.css");
static CORE_JS: &[u8] = include_bytes!("C:\\Users\\preet\\Documents\\projects\\personal-translator\\apps\\desktop\\dist\\assets\\core-DhEqZVGG.js");
static APP_JS: &[u8] = include_bytes!("C:\\Users\\preet\\Documents\\projects\\personal-translator\\apps\\desktop\\dist\\assets\\index-DrEoi_Cf.js");

fn embedded_files() -> HashMap<&'static str, (&'static [u8], &'static str)> {
    let mut m = HashMap::new();
    m.insert("/", (INDEX_HTML, "text/html"));
    m.insert("/index.html", (INDEX_HTML, "text/html"));
    m.insert("/assets/index-CEktmZl2.css", (CSS, "text/css"));
    m.insert("/assets/core-DhEqZVGG.js", (CORE_JS, "application/javascript"));
    m.insert("/assets/index-DrEoi_Cf.js", (APP_JS, "application/javascript"));
    m
}

fn serve_static(path: &str) -> impl IntoResponse {
    let files = embedded_files();
    let p = if path == "/" || path.is_empty() { "/" } else { path.trim_end_matches('/') };
    let entry = files.get(p).or_else(|| {
        if !p.starts_with("/assets/") {
            files.get("/")
        } else {
            None
        }
    });
    match entry {
        Some((data, mime)) => {
            let mut headers = HeaderMap::new();
            headers.insert("content-type", mime.parse().unwrap());
            (StatusCode::OK, headers, data.to_vec()).into_response()
        }
        None => (StatusCode::NOT_FOUND, HeaderMap::new(), b"Not Found".to_vec()).into_response(),
    }
}

// ── Axum HTTP Server (frontend only, API via Tauri IPC) ──────

pub fn start_server(port: Option<u16>) -> u16 {
    let port = port.unwrap_or_else(|| portpicker::pick_unused_port().expect("no free port found"));
    let app = Router::new()
        .route("/{*path}", get(|uri: Uri| async move { serve_static(uri.path()) }))
        .route("/", get(|| async move { serve_static("/") }))
        .layer(CorsLayer::permissive())
        .fallback(|| async { (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Not found"}))).into_response() });

    let addr = format!("127.0.0.1:{}", port);
    let addr_clone = addr.clone();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let listener = tokio::net::TcpListener::bind(&addr_clone).await.unwrap();
            log::info!("Embedded server listening on {}", addr_clone);
            axum::serve(listener, app).await.unwrap();
        });
    });
    log::info!("Starting embedded server on {}", addr);
    port
}
