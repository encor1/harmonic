use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Read,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
};
use tauri::{AppHandle, Emitter, Manager, State};

const SAMPLE_RATE: f32 = 44_100.0;
const SAMPLE_WINDOW: usize = 2048;
const SAMPLE_HOP: usize = 512;
const BAND_COUNT: usize = 64;

#[derive(Default)]
struct CaptureState {
    process: Mutex<Option<CaptureProcess>>,
}

struct CaptureProcess {
    child: Child,
    running: Arc<AtomicBool>,
}

#[derive(Clone, Serialize)]
struct SpectrumPayload {
    bands: Vec<u8>,
    level: u8,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct VisualizerSettings {
    version: u8,
    last_mode: String,
    modes: serde_json::Value,
}

#[tauri::command]
fn start_linux_audio(app: AppHandle, state: State<'_, CaptureState>) -> Result<(), String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        let _ = state;
        return Err("Native audio capture is currently Linux-only.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let mut guard = state
            .process
            .lock()
            .map_err(|_| "Audio capture state is unavailable.".to_string())?;

        if guard.is_some() {
            return Ok(());
        }

        let mut child = Command::new("parec")
            .args([
                "--record",
                "--device=@DEFAULT_MONITOR@",
                "--format=s16le",
                "--rate=44100",
                "--channels=1",
                "--latency-msec=25",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| {
                format!(
                    "Could not start parec. Install pulseaudio-utils or pipewire-pulse. ({error})"
                )
            })?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Could not read audio stream from parec.".to_string())?;
        let running = Arc::new(AtomicBool::new(true));
        let thread_running = Arc::clone(&running);
        let thread_app = app.clone();

        thread::spawn(move || read_audio_stream(stdout, thread_app, thread_running));

        *guard = Some(CaptureProcess { child, running });
        Ok(())
    }
}

#[tauri::command]
fn stop_linux_audio(state: State<'_, CaptureState>) -> Result<(), String> {
    let mut guard = state
        .process
        .lock()
        .map_err(|_| "Audio capture state is unavailable.".to_string())?;

    if let Some(mut capture) = guard.take() {
        capture.running.store(false, Ordering::Relaxed);
        let _ = capture.child.kill();
        let _ = capture.child.wait();
    }

    Ok(())
}

#[tauri::command]
fn load_visualizer_settings(app: AppHandle) -> Result<Option<VisualizerSettings>, String> {
    let path = settings_path(&app)?;

    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read visualizer settings. ({error})"))?;
    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|error| format!("Could not parse visualizer settings. ({error})"))
}

#[tauri::command]
fn save_visualizer_settings(
    app: AppHandle,
    settings: VisualizerSettings,
) -> Result<(), String> {
    let path = settings_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Could not resolve visualizer settings directory.".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create visualizer settings directory. ({error})"))?;

    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("Could not serialize visualizer settings. ({error})"))?;

    fs::write(path, contents)
        .map_err(|error| format!("Could not save visualizer settings. ({error})"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Could not resolve app config directory. ({error})"))?;
    dir.push("settings.json");
    Ok(dir)
}

fn read_audio_stream<R: Read>(mut stream: R, app: AppHandle, running: Arc<AtomicBool>) {
    let mut bytes = [0_u8; 4096];
    let mut samples = Vec::<i16>::with_capacity(SAMPLE_WINDOW * 2);

    while running.load(Ordering::Relaxed) {
        let Ok(count) = stream.read(&mut bytes) else {
            break;
        };

        if count == 0 {
            break;
        }

        for chunk in bytes[..count].chunks_exact(2) {
            samples.push(i16::from_le_bytes([chunk[0], chunk[1]]));
        }

        while samples.len() >= SAMPLE_WINDOW {
            let payload = analyze_samples(&samples[..SAMPLE_WINDOW]);
            let _ = app.emit("spectrum", payload);
            samples.drain(..SAMPLE_HOP);
        }
    }
}

fn analyze_samples(samples: &[i16]) -> SpectrumPayload {
    let mut magnitudes = Vec::with_capacity(BAND_COUNT);
    let mut sum_squares = 0.0_f32;

    for &sample in samples {
        let normalized = f32::from(sample) / f32::from(i16::MAX);
        sum_squares += normalized * normalized;
    }

    let rms = (sum_squares / samples.len() as f32).sqrt();
    let level = (rms * 180.0).clamp(0.0, 99.0).round() as u8;

    if rms < 0.003 {
        return SpectrumPayload {
            bands: vec![0; BAND_COUNT],
            level,
        };
    }

    for band in 0..BAND_COUNT {
        let progress = band as f32 / (BAND_COUNT - 1) as f32;
        let frequency = 40.0_f32 * (16_000.0_f32 / 40.0_f32).powf(progress);
        let magnitude = goertzel_magnitude(samples, frequency);
        magnitudes.push(magnitude);
    }

    SpectrumPayload {
        bands: shape_spectrum(&magnitudes),
        level,
    }
}

fn shape_spectrum(magnitudes: &[f32]) -> Vec<u8> {
    magnitudes
        .iter()
        .enumerate()
        .map(|(band, &magnitude)| {
            let progress = band as f32 / (magnitudes.len() - 1) as f32;
            let presence_lift = 1.0 + progress * 2.2;
            let weighted = (magnitude * presence_lift).max(0.000_001);
            let db = 20.0 * weighted.log10();
            let normalized = ((db + 76.0) / 64.0).clamp(0.0, 1.0);
            (normalized.powf(1.55) * 190.0).round() as u8
        })
        .collect()
}

fn goertzel_magnitude(samples: &[i16], frequency: f32) -> f32 {
    let normalized_frequency = frequency / SAMPLE_RATE;
    let coefficient = 2.0 * (2.0 * std::f32::consts::PI * normalized_frequency).cos();
    let mut previous = 0.0_f32;
    let mut previous_2 = 0.0_f32;

    for (index, &sample) in samples.iter().enumerate() {
        let window = hann_window(index, samples.len());
        let value = f32::from(sample) / f32::from(i16::MAX) * window;
        let current = value + coefficient * previous - previous_2;
        previous_2 = previous;
        previous = current;
    }

    let power = previous_2 * previous_2 + previous * previous - coefficient * previous * previous_2;
    power.max(0.0).sqrt() / samples.len() as f32
}

fn hann_window(index: usize, len: usize) -> f32 {
    0.5 - 0.5 * (2.0 * std::f32::consts::PI * index as f32 / (len - 1) as f32).cos()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CaptureState::default())
        .invoke_handler(tauri::generate_handler![
            load_visualizer_settings,
            save_visualizer_settings,
            start_linux_audio,
            stop_linux_audio
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
