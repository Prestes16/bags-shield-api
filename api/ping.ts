export default function handler(req: any, res: any) {
  res.status(200).json({
    success: true,
    message: 'pong',
    time: new Date().toISOString(),
  });
}
