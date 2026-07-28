/// Extract raw PCM samples from a WAV file.
/// Returns the PCM data after the header and any RIFF chunks.
pub fn extract_pcm_from_wav(wav: &[u8]) -> Result<Vec<u8>, String> {
    if wav.len() < 44 {
        return Err("Invalid WAV".to_string());
    }
    // Find the "data" chunk in the RIFF container
    let mut offset = 12; // skip RIFF header + file size + WAVE
    while offset + 8 <= wav.len() {
        let chunk_id = &wav[offset..offset + 4];
        let chunk_size = u32::from_le_bytes(
            wav[offset + 4..offset + 8].try_into().unwrap(),
        ) as usize;
        if chunk_id == b"data" {
            let data_start = offset + 8;
            let data_end = (data_start + chunk_size).min(wav.len());
            return Ok(wav[data_start..data_end].to_vec());
        }
        offset += 8 + chunk_size;
        // Align to even byte boundary (RIFF spec)
        if chunk_size % 2 != 0 {
            offset += 1;
        }
    }
    // No data chunk found; assume PCM starts after the 44-byte header
    if wav.len() > 44 {
        Ok(wav[44..].to_vec())
    } else {
        Err("No PCM data found in WAV".to_string())
    }
}

/// Write a 44-byte WAV header for 16-bit mono PCM audio.
pub fn write_wav_header(sample_rate: u32, data_length: u32) -> Vec<u8> {
    let num_channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * num_channels as u32 * (bits_per_sample as u32 / 8);
    let block_align = num_channels * (bits_per_sample / 8);
    let header_size = 36;

    let mut h = vec![0u8; 44];

    // RIFF header
    h[0..4].copy_from_slice(b"RIFF");
    h[4..8].copy_from_slice(&(header_size + data_length).to_le_bytes());
    h[8..12].copy_from_slice(b"WAVE");

    // fmt chunk
    h[12..16].copy_from_slice(b"fmt ");
    h[16..20].copy_from_slice(&(16u32).to_le_bytes()); // chunk size
    h[20..22].copy_from_slice(&(1u16).to_le_bytes()); // PCM format
    h[22..24].copy_from_slice(&num_channels.to_le_bytes());
    h[24..28].copy_from_slice(&sample_rate.to_le_bytes());
    h[28..32].copy_from_slice(&byte_rate.to_le_bytes());
    h[32..34].copy_from_slice(&block_align.to_le_bytes());
    h[34..36].copy_from_slice(&bits_per_sample.to_le_bytes());

    // data chunk
    h[36..40].copy_from_slice(b"data");
    h[40..44].copy_from_slice(&data_length.to_le_bytes());

    h
}
