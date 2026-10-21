"""Run local audio generation with Linux seccomp denying Internet sockets.

This only reduces the current process's permissions, is inherited by workers,
and fails closed if the operating system cannot install the filter.
"""
import ctypes, errno, platform, runpy, sys

def restrict_network():
 if sys.platform!='linux':raise RuntimeError('Offline runner requires Linux seccomp')
 machine=platform.machine()
 numbers={'x86_64':(41,42,44,46),'aarch64':(198,203,206,211)}
 if machine not in numbers:raise RuntimeError('Unsupported architecture for offline runner')
 socket_nr,connect_nr,sendto_nr,sendmsg_nr=numbers[machine]
 class Filter(ctypes.Structure):
  _fields_=[('code',ctypes.c_ushort),('jt',ctypes.c_ubyte),('jf',ctypes.c_ubyte),('k',ctypes.c_uint32)]
 class Program(ctypes.Structure):
  _fields_=[('len',ctypes.c_ushort),('filter',ctypes.POINTER(Filter))]
 # Load syscall number. Deny connection/sending syscalls. For socket(), deny
 # AF_INET (2) and AF_INET6 (10), retaining AF_UNIX for worker communication.
 ops=[(0x20,0,0,0)]
 for nr in [connect_nr,sendto_nr,sendmsg_nr]:ops.extend([(0x15,0,1,nr),(0x06,0,0,0x00050000|errno.EPERM)])
 ops.extend([(0x15,0,4,socket_nr),(0x20,0,0,16),(0x15,1,0,2),(0x15,0,1,10),(0x06,0,0,0x00050000|errno.EPERM),(0x06,0,0,0x7fff0000)])
 filters=(Filter*len(ops))(*(Filter(*x) for x in ops));program=Program(len(ops),filters)
 libc=ctypes.CDLL(None,use_errno=True)
 if libc.prctl(38,1,0,0,0)!=0 or libc.prctl(22,2,ctypes.byref(program),0,0)!=0:raise OSError(ctypes.get_errno(),'Cannot enforce offline generation')

if __name__=='__main__':
 restrict_network()
 if sys.argv[1:]==['--check']:
  import socket
  for family in [socket.AF_INET,socket.AF_INET6]:
   try:socket.socket(family,socket.SOCK_STREAM)
   except PermissionError:pass
   else:raise RuntimeError('Internet socket was not blocked')
  print('PASS: IPv4 and IPv6 sockets denied by the kernel')
 else:
  if len(sys.argv)<2:raise SystemExit('Pass a local Python script and arguments')
  script=sys.argv[1];sys.argv=sys.argv[1:];runpy.run_path(script,run_name='__main__')
